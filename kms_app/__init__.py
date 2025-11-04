"""MindBase application package."""

from .app import launch_app
from .webapp import create_app

__all__ = ["launch_app", "create_app"]
