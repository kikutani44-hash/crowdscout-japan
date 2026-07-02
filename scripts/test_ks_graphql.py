#!/usr/bin/env python3
"""Test Kickstarter GraphQL API for project creator information."""

import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env.local")

GRAPHQL_URL = "https://www.kickstarter.com/graph"

QUERY = """
query {
  project(slug: "tsuki-a-japanese-knife-designed-to-be-admired") {
    creator {
      name
      websites {
        url
      }
    }
  }
}
"""

HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    ),
}


def main() -> None:
    try:
        r = requests.post(
            GRAPHQL_URL,
            headers=HEADERS,
            json={"query": QUERY},
            timeout=60,
        )
        print(f"Status: {r.status_code}")
        print(f"Response: {r.text[:2000]}")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
