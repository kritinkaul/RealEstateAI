import json
from functools import lru_cache
from pathlib import Path
from typing import Any


DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "projects.json"


@lru_cache
def load_portfolio() -> dict[str, Any]:
    with DATA_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def list_projects() -> list[dict[str, Any]]:
    return load_portfolio()["projects"]


def load_project(project_id: str | None = None) -> dict[str, Any]:
    projects = list_projects()
    if project_id is None:
        return projects[0]

    for project in projects:
        if project["id"] == project_id:
            return project

    raise KeyError(project_id)
