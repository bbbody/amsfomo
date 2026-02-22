#!/usr/bin/env python3
"""
AMSFOMO — Amsterdam Venue Event Monitor

Scrapes event listings from 4 Amsterdam venues and tracks new events.
Writes results to events.json and logs new discoveries to updates.log.

Schedule daily via cron:
    crontab -e
    0 9 * * * /Users/bryanwolff/Documents/AMSFOMO/.venv/bin/python3 /Users/bryanwolff/Documents/AMSFOMO/monitor.py
"""

import hashlib
import json
import logging
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

SCRIPT_DIR = Path(__file__).resolve().parent
VENUES_FILE = SCRIPT_DIR / "venues.json"
EVENTS_FILE = SCRIPT_DIR / "events.json"
LOG_FILE = SCRIPT_DIR / "updates.log"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
REQUEST_TIMEOUT = 30

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stderr),
    ],
)
log = logging.getLogger(__name__)


def make_event_id(venue_slug: str, title: str, date: str) -> str:
    raw = f"{venue_slug}|{title.strip().lower()}|{date.strip().lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:12]


def fetch_page(url: str) -> requests.Response | None:
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp
    except requests.RequestException as e:
        log.error("Failed to fetch %s: %s", url, e)
        return None


# ---------------------------------------------------------------------------
# Venue-specific scrapers
# ---------------------------------------------------------------------------

PARADISO_GRAPHQL_URL = "https://knwxh8dmh1.execute-api.eu-central-1.amazonaws.com/graphql"
PARADISO_API_TOKEN = "qNG1MfNixLtJU_iE_nvJ3ssmMY5NZ3Nx"
PARADISO_GRAPHQL_QUERY = """
{
  program(size: 500) {
    events {
      ... on eventType {
        id
        uri
        title
        date
        startDateTime
        subtitle
        eventStatus
        soldOut
        supportAct
        location { id title }
      }
    }
  }
}
"""


def scrape_paradiso() -> list[dict]:
    """Paradiso: fetch all events via their GraphQL API."""
    base_url = "https://www.paradiso.nl"
    try:
        resp = requests.post(
            PARADISO_GRAPHQL_URL,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {PARADISO_API_TOKEN}",
            },
            json={"query": PARADISO_GRAPHQL_QUERY},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as e:
        log.error("Paradiso GraphQL failed: %s", e)
        return []

    if "errors" in data:
        log.error("Paradiso GraphQL errors: %s", data["errors"])
        return []

    api_events = data.get("data", {}).get("program", {}).get("events", [])
    events = []
    seen = set()

    for ev in api_events:
        title = ev.get("title", "")
        if not title:
            continue

        date = ev.get("date", "")
        uri = ev.get("uri", "")
        event_url = urljoin(base_url + "/en/", uri) if uri else ""
        location = ""
        loc_list = ev.get("location") or []
        if loc_list:
            location = loc_list[0].get("title", "")

        sold_out = ev.get("soldOut", "no")
        status = ""
        if sold_out in ("yes", "yesWithWaitingList"):
            status = "sold out"
        elif ev.get("eventStatus") == "canceled":
            status = "cancelled"

        eid = make_event_id("paradiso", title, date)
        if eid in seen:
            continue
        seen.add(eid)

        events.append(_clean_event({
            "id": eid,
            "title": title,
            "date": date,
            "date_iso": ev.get("startDateTime", "")[:10] or None,
            "type": ev.get("subtitle") or None,
            "venue_detail": location or None,
            "status": status or None,
            "url": event_url,
        }))

    return events


def scrape_melkweg() -> list[dict]:
    """Melkweg: CSS modules with stable class name patterns. Day groups contain event cards."""
    url = "https://www.melkweg.nl/nl/agenda/"
    resp = fetch_page(url)
    if not resp:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    events = []
    seen = set()

    # Structure: day wrapper li (event-list-compact__item) contains:
    #   - h2 with date ("za 21 feb") + time[datetime]
    #   - ol with event li items (event-list-day__list-item), each containing:
    #     - a (event-compact) with h3 title, ul type list, p genre tags, span label

    day_items = soup.find_all("li", class_=lambda c: c and "event-list-compact__item" in c)
    for day_item in day_items:
        # Extract date from the day header
        time_el = day_item.find("time")
        date = time_el.get("datetime", "") if time_el else ""
        date_display = time_el.get_text(strip=True) if time_el else ""

        # Find all event cards within this day
        event_cards = day_item.find_all("li", class_=lambda c: c and "event-list-day__list-item" in c)
        for card in event_cards:
            a_tag = card.find("a", href=True)
            if not a_tag:
                continue

            h3 = a_tag.find("h3")
            if not h3:
                continue
            title = h3.get_text(strip=True)
            if not title:
                continue

            href = urljoin(url, a_tag["href"])

            # Type (Concert, Club, Film, etc.) from the type list
            event_type = ""
            type_ul = a_tag.find("ul", class_=lambda c: c and "type-list" in c)
            if type_ul:
                first_li = type_ul.find("li")
                if first_li:
                    event_type = first_li.get_text(strip=True)

            # Genre tags
            genre = ""
            genre_p = a_tag.find("p", class_=lambda c: c and "tags-list" in c)
            if genre_p:
                tags = [s.get_text(strip=True) for s in genre_p.find_all("span", recursive=False)]
                genre = " · ".join(t for t in tags if t and t != "·")

            # Status label (Uitverkocht, etc.)
            status = ""
            label = a_tag.find("span", class_=lambda c: c and "label" in c)
            if label:
                status = label.get_text(strip=True)

            eid = make_event_id("melkweg", title, date_display)
            if eid in seen:
                continue
            seen.add(eid)

            events.append(_clean_event({
                "id": eid,
                "title": title,
                "date": date_display,
                "date_iso": date or None,
                "type": event_type or None,
                "genre": genre or None,
                "status": status or None,
                "url": href,
            }))

    return events


def scrape_oudekerk() -> list[dict]:
    """Oude Kerk: Chakra UI. Cards with combined date+title text. Links contain /evenementen/ or /tentoonstellingen/."""
    url = "https://www.oudekerk.nl/publieksprogramma"
    resp = fetch_page(url)
    if not resp:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    events = []
    seen = set()

    # Find all internal links to events/exhibitions
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        if "/nu-te-zien/" not in href and "/evenementen/" not in href and "/tentoonstellingen/" not in href:
            continue

        # Get text, stripping common CTA suffixes
        full_text = a_tag.get_text(strip=True)
        for suffix in ("Lees meer", "Read more", "Meer info", "More info"):
            if full_text.endswith(suffix):
                full_text = full_text[: -len(suffix)].strip()
        if not full_text or len(full_text) < 3:
            continue

        # Determine type from URL path
        if "/tentoonstellingen/" in href:
            event_type = "Tentoonstelling"
        elif "/evenementen/" in href:
            event_type = "Evenement"
        else:
            event_type = ""

        # Parse date from the combined text (format: "20 februari 13:00 - Title")
        date = ""
        title = full_text
        date_match = re.match(
            r'^(\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)'
            r'(?:\s+\d{2,4})?(?:\s+\d{1,2}:\d{2})?)\s*[-–]\s*(.+)',
            full_text, re.I
        )
        if date_match:
            date = date_match.group(1).strip()
            title = date_match.group(2).strip()
        else:
            # Try simpler date prefix: "t/m 23 maart" or date range
            range_match = re.match(
                r'^((?:t/m|tot|vanaf)?\s*\d{1,2}\s+\w+(?:\s*[-–]\s*\d{1,2}\s+\w+)?)\s*[-–]\s*(.+)',
                full_text, re.I
            )
            if range_match:
                date = range_match.group(1).strip()
                title = range_match.group(2).strip()

        if not title:
            continue

        full_url = urljoin(url, href)
        eid = make_event_id("oudekerk", title, date)
        if eid in seen:
            continue
        seen.add(eid)

        events.append(_clean_event({
            "id": eid,
            "title": title,
            "date": date,
            "type": event_type or None,
            "url": full_url,
        }))

    return events


def scrape_tivoli() -> list[dict]:
    """TivoliVredenburg: WordPress with paginated agenda. BEM classes on list items."""
    base_url = "https://www.tivolivredenburg.nl/agenda/"
    events = []
    seen = set()
    page = 1

    while True:
        url = f"{base_url}page/{page}/" if page > 1 else base_url
        resp = fetch_page(url)
        if not resp:
            break

        soup = BeautifulSoup(resp.text, "html.parser")
        items = soup.find_all("li", class_=lambda c: c and "agenda-list-item" in c)
        if not items:
            break

        for item in items:
            title_el = item.find(class_="agenda-list-item__title")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if not title:
                continue

            # Date
            time_el = item.find(class_="agenda-list-item__time")
            date = time_el.get_text(strip=True) if time_el else ""

            # URL
            link = item.find("a", class_="agenda-list-item__title-link")
            event_url = link["href"] if link and link.get("href") else ""

            # Description / subtitle
            text_el = item.find(class_="agenda-list-item__text")
            description = text_el.get_text(strip=True) if text_el else ""

            # Status (Uitverkocht, Verplaatst, etc.)
            label_el = item.find(class_="agenda-list-item__label")
            status = label_el.get_text(strip=True) if label_el else ""

            eid = make_event_id("tivoli", title, date)
            if eid in seen:
                continue
            seen.add(eid)

            events.append(_clean_event({
                "id": eid,
                "title": title,
                "date": date,
                "description": description or None,
                "status": status or None,
                "url": event_url,
            }))

        # Check for next page
        load_more = soup.find("div", class_="js-load-more-button")
        if not load_more or not load_more.find("a"):
            break
        page += 1

    return events


def _clean_event(event: dict) -> dict:
    """Remove None values from event dict."""
    return {k: v for k, v in event.items() if v is not None}


# ---------------------------------------------------------------------------
# Registry mapping slugs to scraper functions
# ---------------------------------------------------------------------------

SCRAPERS = {
    "paradiso": scrape_paradiso,
    "melkweg": scrape_melkweg,
    "oudekerk": scrape_oudekerk,
    "tivoli": scrape_tivoli,
}


def load_existing_events() -> dict:
    if EVENTS_FILE.exists():
        try:
            return json.loads(EVENTS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            log.warning("Could not read existing events.json: %s", e)
    return {"last_updated": None, "venues": {}}


def save_events(data: dict) -> None:
    EVENTS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def merge_events(slug: str, new_events: list[dict], existing_venues: dict) -> tuple[list[dict], int]:
    now = datetime.now().isoformat(timespec="seconds")
    prev_events = {}
    if slug in existing_venues:
        for ev in existing_venues[slug].get("events", []):
            prev_events[ev["id"]] = ev

    merged = []
    new_count = 0
    for ev in new_events:
        eid = ev["id"]
        if eid in prev_events:
            entry = {**ev, "first_seen": prev_events[eid]["first_seen"], "last_seen": now, "is_new": False}
        else:
            entry = {**ev, "first_seen": now, "last_seen": now, "is_new": True}
            new_count += 1
        merged.append(entry)

    return merged, new_count


def main():
    log.info("=" * 60)
    log.info("AMSFOMO monitor run starting")

    try:
        venues = json.loads(VENUES_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        log.error("Failed to read venues.json: %s", e)
        sys.exit(1)

    existing_data = load_existing_events()
    existing_venues = existing_data.get("venues", {})
    now = datetime.now().isoformat(timespec="seconds")

    updated_venues = {}
    total_new = 0

    for venue in venues:
        name = venue["name"]
        slug = venue["slug"]
        log.info("Scraping %s ...", name)

        scraper = SCRAPERS.get(slug)
        if not scraper:
            log.error("No scraper defined for slug '%s'", slug)
            continue

        try:
            events = scraper()
        except Exception as e:
            log.error("Error scraping %s: %s", name, e, exc_info=True)
            if slug in existing_venues:
                updated_venues[slug] = existing_venues[slug]
            continue

        merged, new_count = merge_events(slug, events, existing_venues)
        total_new += new_count

        updated_venues[slug] = {
            "name": name,
            "url": venue["url"],
            "events": merged,
            "last_scraped": now,
        }

        log.info("%s: %d events total, %d new", name, len(merged), new_count)
        for ev in merged:
            if ev.get("is_new"):
                log.info("  NEW: %s — %s %s", ev["title"], ev.get("date", ""), ev.get("url", ""))

    output = {"last_updated": now, "venues": updated_venues}
    save_events(output)

    log.info("Done. %d total new events across all venues.", total_new)
    log.info("Results saved to %s", EVENTS_FILE)


if __name__ == "__main__":
    main()
