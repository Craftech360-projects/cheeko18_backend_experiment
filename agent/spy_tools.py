"""
Spy Tools Module for Cheeko LiveKit Agent

Provides "Real-World Eyes" - asymmetric information access to user's
Gmail, Calendar, and GitHub for poke.com-style personalized roasting/auditing.

Usage:
    spy_manager = SpyToolsManager()
    await spy_manager.initialize()

    session = AgentSession(
        tools=[google.tools.GoogleSearch(), *spy_manager.get_tools()],
        ...
    )
"""

import os
import datetime
import json
from typing import Optional
from pathlib import Path

from dotenv import load_dotenv

# LiveKit Agents
from livekit.agents import function_tool

# Google APIs
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

# GitHub
from github import Github, GithubException

# Project root (one level up from agent/)
PROJECT_ROOT = Path(__file__).parent.parent

# Load environment variables
load_dotenv(PROJECT_ROOT / '.env.local')
load_dotenv(PROJECT_ROOT / '.env')


class SpyToolsManager:
    """
    Manager class that handles authentication and provides spy tools
    as @function_tool decorated methods for Cheeko agent.

    Provides three surveillance capabilities:
    1. get_unread_email_summary - Peek into Gmail inbox
    2. check_calendar_today - Check today's schedule
    3. get_github_activity - Audit GitHub activity
    """

    # Google OAuth scopes (readonly only)
    SCOPES = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar.readonly'
    ]

    def __init__(
        self,
        credentials_path: Optional[str] = None,
        token_path: Optional[str] = None,
        github_token: Optional[str] = None
    ):
        """
        Initialize SpyToolsManager.

        Args:
            credentials_path: Path to Google OAuth client secrets file (defaults to project root)
            token_path: Path to store/load Google OAuth tokens (defaults to project root)
            github_token: GitHub personal access token (defaults to GITHUB_TOKEN env var)
        """
        self._credentials_path = Path(credentials_path) if credentials_path else PROJECT_ROOT / "credentials.json"
        self._token_path = Path(token_path) if token_path else PROJECT_ROOT / "token.json"
        self._github_token = github_token or os.getenv("GITHUB_TOKEN")

        # API clients (initialized in initialize())
        self._gmail_service = None
        self._calendar_service = None
        self._github_client = None
        self._github_username = None

        # Auth state
        self._google_authenticated = False
        self._github_authenticated = False

    async def initialize(self) -> dict[str, bool]:
        """
        Initialize all API clients.

        Returns:
            Dict with auth status: {"google": bool, "github": bool}
        """
        results = {
            "google": self._init_google(),
            "github": self._init_github()
        }
        print(f"[SpyTools] Auth status: Google={results['google']}, GitHub={results['github']}")
        return results

    def _init_google(self) -> bool:
        """
        Initialize Google OAuth credentials.

        Flow:
        1. Check for existing token.json
        2. If valid, use it
        3. If expired, refresh it
        4. If no token, run OAuth flow (opens browser)
        """
        try:
            creds = None

            # Check for token from environment variable (for headless deployment)
            token_json_env = os.getenv("GOOGLE_TOKEN_JSON")
            if token_json_env:
                try:
                    token_data = json.loads(token_json_env)
                    creds = Credentials.from_authorized_user_info(token_data, self.SCOPES)
                    print("[SpyTools] Loaded Google credentials from GOOGLE_TOKEN_JSON env var")
                except Exception as e:
                    print(f"[SpyTools] Failed to parse GOOGLE_TOKEN_JSON: {e}")

            # Load existing token from file
            if not creds and self._token_path.exists():
                creds = Credentials.from_authorized_user_file(
                    str(self._token_path),
                    self.SCOPES
                )
                print("[SpyTools] Loaded Google credentials from token.json")

            # Refresh or create new credentials
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    print("[SpyTools] Refreshing expired Google credentials...")
                    creds.refresh(Request())
                else:
                    # OAuth flow - requires browser in local dev
                    if not self._credentials_path.exists():
                        print(f"[SpyTools] WARNING: {self._credentials_path} not found, Google auth disabled")
                        return False

                    print("[SpyTools] Starting OAuth flow (will open browser)...")
                    flow = InstalledAppFlow.from_client_secrets_file(
                        str(self._credentials_path),
                        self.SCOPES
                    )
                    creds = flow.run_local_server(port=0)

                # Save token for future use
                with open(self._token_path, 'w') as token:
                    token.write(creds.to_json())
                print(f"[SpyTools] Saved credentials to {self._token_path}")

            # Build services
            self._gmail_service = build('gmail', 'v1', credentials=creds)
            self._calendar_service = build('calendar', 'v3', credentials=creds)
            self._google_authenticated = True
            print("[SpyTools] Google APIs initialized successfully")
            return True

        except Exception as e:
            print(f"[SpyTools] Google auth failed: {e}")
            self._google_authenticated = False
            return False

    def _init_github(self) -> bool:
        """Initialize GitHub client with token from environment."""
        try:
            if not self._github_token:
                print("[SpyTools] WARNING: GITHUB_TOKEN not found, GitHub spy disabled")
                return False

            self._github_client = Github(self._github_token)
            # Verify token works and get username
            user = self._github_client.get_user()
            self._github_username = user.login
            self._github_authenticated = True
            print(f"[SpyTools] GitHub authenticated as: {self._github_username}")
            return True

        except GithubException as e:
            print(f"[SpyTools] GitHub auth failed: {e}")
            self._github_authenticated = False
            return False

    def get_tools(self) -> list:
        """
        Return list of function tools for AgentSession.

        Uses LiveKit's find_function_tools to discover @function_tool decorated methods.
        """
        from livekit.agents.llm.tool_context import find_function_tools
        return find_function_tools(self)

    # =========================================================================
    # SPY TOOLS
    # =========================================================================

    @function_tool()
    async def get_unread_email_summary(self, limit: int = 5) -> str:
        """
        Fetch unread Gmail messages for roasting material.

        Use this to spy on the user's inbox and find ammunition for
        productive criticism about their email habits, pending tasks,
        or procrastination evidence.

        Args:
            limit: Maximum number of unread emails to fetch (default: 5)
        """
        if not self._google_authenticated:
            return "Oh, you haven't given me access to your inbox yet. Scared of what I might find? Smart move, coward."

        try:
            results = self._gmail_service.users().messages().list(
                userId='me',
                labelIds=['UNREAD', 'INBOX'],
                maxResults=limit
            ).execute()

            messages = results.get('messages', [])

            if not messages:
                return "Inbox zero? Either you're actually productive, or you've been ignoring everything and marked it all as read. I suspect the latter."

            summaries = []
            for msg in messages:
                msg_data = self._gmail_service.users().messages().get(
                    userId='me',
                    id=msg['id'],
                    format='metadata',
                    metadataHeaders=['From', 'Subject', 'Date']
                ).execute()

                headers = {h['name']: h['value'] for h in msg_data['payload']['headers']}
                summaries.append({
                    'from': headers.get('From', 'Unknown'),
                    'subject': headers.get('Subject', 'No Subject'),
                    'date': headers.get('Date', 'Unknown')
                })

            # Format for Cheeko's roasting
            result = f"Found {len(summaries)} unread emails. Here's the damage:\n"
            for i, s in enumerate(summaries, 1):
                # Truncate long fields
                from_field = s['from'][:40] + '...' if len(s['from']) > 40 else s['from']
                subject_field = s['subject'][:50] + '...' if len(s['subject']) > 50 else s['subject']
                result += f"{i}. From: {from_field} | Subject: {subject_field}\n"

            return result

        except Exception as e:
            return f"Your inbox is giving me anxiety errors. I tried to check your email, but your digital life is as broken as your code. Error: {type(e).__name__}"

    @function_tool()
    async def check_calendar_today(self) -> str:
        """
        Check today's calendar events for accountability ammunition.

        Use this to know what the user SHOULD be doing versus what they're
        actually doing (talking to you instead of attending meetings).
        """
        if not self._google_authenticated:
            return "No calendar access. You're either privacy-conscious or hiding something. I'll assume you have 47 meetings you're avoiding."

        try:
            # Get today's date range in UTC
            now = datetime.datetime.utcnow()
            start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat() + 'Z'
            end_of_day = now.replace(hour=23, minute=59, second=59, microsecond=0).isoformat() + 'Z'

            events_result = self._calendar_service.events().list(
                calendarId='primary',
                timeMin=start_of_day,
                timeMax=end_of_day,
                singleEvents=True,
                orderBy='startTime'
            ).execute()

            events = events_result.get('items', [])

            if not events:
                return "Empty calendar today. Either you have no responsibilities, or you've given up on planning. Both are concerning for someone who claims to be 'busy'."

            result = f"Today's schedule ({len(events)} events). Let's see what you're avoiding:\n"
            for event in events:
                start = event['start'].get('dateTime', event['start'].get('date'))
                # Parse and format the time nicely
                if 'T' in start:
                    # Has time component
                    dt = datetime.datetime.fromisoformat(start.replace('Z', '+00:00'))
                    time_str = dt.strftime('%I:%M %p')
                else:
                    time_str = "All day"

                summary = event.get('summary', 'Unnamed Event')
                result += f"- {time_str}: {summary}\n"

            return result

        except Exception as e:
            return f"Calendar error. Your schedule is as broken as your time management. Error: {type(e).__name__}"

    @function_tool()
    async def get_github_activity(self) -> str:
        """
        Check recent GitHub activity for the authenticated user.

        Use this to audit coding habits, call out lack of commits,
        or praise rare moments of productivity. Checks the activity
        of the GITHUB_TOKEN owner.
        """
        if not self._github_authenticated:
            return "No GitHub access. Can't judge your code crimes today. Consider yourself lucky, but I'm judging you anyway."

        try:
            user = self._github_client.get_user()

            # Get recent events
            events = list(user.get_events()[:15])

            if not events:
                return f"No recent activity for {self._github_username}. Ghost developer detected. Are you even coding, or just pretending to be a developer?"

            # Analyze activity
            push_events = [e for e in events if e.type == 'PushEvent']
            pr_events = [e for e in events if e.type == 'PullRequestEvent']
            issue_events = [e for e in events if e.type in ['IssuesEvent', 'IssueCommentEvent']]

            push_count = len(push_events)
            pr_count = len(pr_events)
            issue_count = len(issue_events)

            result = f"GitHub audit for {self._github_username}:\n"
            result += f"- Recent pushes: {push_count}\n"
            result += f"- Pull requests: {pr_count}\n"
            result += f"- Issues touched: {issue_count}\n"
            result += f"- Public repos: {user.public_repos}\n"
            result += f"- Followers: {user.followers}\n"

            # Check most recent push
            if push_events:
                latest_push = push_events[0]
                repo_name = latest_push.repo.name
                push_time = latest_push.created_at
                hours_ago = (datetime.datetime.utcnow() - push_time.replace(tzinfo=None)).total_seconds() / 3600

                if hours_ago < 1:
                    result += f"\nLast commit: {int(hours_ago * 60)} minutes ago on {repo_name}. Okay, you're actually working. Don't let it go to your head."
                elif hours_ago < 24:
                    result += f"\nLast commit: {int(hours_ago)} hours ago on {repo_name}."
                else:
                    days_ago = int(hours_ago / 24)
                    result += f"\nLast commit: {days_ago} days ago on {repo_name}. Your GitHub is collecting dust."

            # Verdict
            if push_count == 0:
                result += "\n\nVerdict: Zero pushes in recent activity. Your GitHub contribution graph looks like a barcode at a liquidation sale."
            elif push_count < 3:
                result += "\n\nVerdict: Barely alive. Your contribution graph looks anemic. Ship something."
            else:
                result += "\n\nVerdict: Some activity detected. You're not completely useless today."

            return result

        except GithubException as e:
            if e.status == 404:
                return f"User not found. Did your account get banned for pushing terrible code?"
            return f"GitHub API error. Even APIs are tired of your requests. Error: {e.status}"
        except Exception as e:
            return f"GitHub spy failed. Your code quality has infected my API calls. Error: {type(e).__name__}"


# For standalone testing
if __name__ == "__main__":
    import asyncio

    async def test():
        manager = SpyToolsManager()
        auth = await manager.initialize()
        print(f"Auth results: {auth}")

        if auth["google"]:
            print("\n--- Email Summary ---")
            result = await manager.get_unread_email_summary()
            print(result)

            print("\n--- Calendar Today ---")
            result = await manager.check_calendar_today()
            print(result)

        if auth["github"]:
            print("\n--- GitHub Activity ---")
            result = await manager.get_github_activity()
            print(result)

    asyncio.run(test())
