"""Media Enrichment Package (Spotify & YouTube)."""

from .spotify_client import SpotifyClient, spotify_client
from .youtube_client import YouTubeClient, youtube_client

__all__ = [
    "SpotifyClient",
    "spotify_client",
    "YouTubeClient",
    "youtube_client",
]
