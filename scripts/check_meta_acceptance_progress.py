#!/usr/bin/env python3
"""Render and validate evidence-based pending META task progress bars.

These values are NOT estimates of coding effort. A check earns 1 point only if
its specified acceptance evidence exists and it is explicitly marked verified.
Updating a checklist requires updating the evidence and README in the same PR.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROGRESS = ROOT / "config/ai/pending-acceptance-progress.json"
PLAN = ROOT / "config/ai/execution-plan.json"
README = ROOT / "README.md"
START = "<!-- META_PENDING_ACCEPTANCE_PROGRESS_START -->"
END = "<!-- META_PENDING_ACCEPTANCE_PROGRESS_END -->"
QUEUE = ("META-007", "META-009", "META-006", "META-010", "META-011", "META-012")


def read_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def percent(verified: int, total: int) -> int:
    if total <= 0 or verified < 0 or verified > total:
        raise ValueError("Invalid acceptance-check count.")
    # Integer round-half-up (3/8 = 38), stable across Python and JS runtimes.
    return (verified * 200 + total) // (2 * total)


def verified_count(unit: dict) -> int:
    return sum(check["verified"] is True for check in unit["checks"])


def validate(data: dict, plan: dict) -> None:
    if data.get("schema_version") != 1:
        raise ValueError("Expected progress schema_version 1.")
    all_units = {item["id"]: item for item in plan["work_units"]}
    if len(all_units) != data["overall_total"] or (
        sum(item["status"] == "complete" for item in all_units.values())
        != data["overall_verified_complete"]
    ):
        raise ValueError("Overall completion is not reconciled with execution plan.")
    pending = {id for id, item in all_units.items() if item["status"] != "complete"}
    ids = [unit["id"] for unit in data["units"]]
    if tuple(ids) != QUEUE or set(ids) != pending:
        raise ValueError("Every pending unit must be present exactly once in queue order.")

    for unit in data["units"]:
        unit_id = unit["id"]
        checks = unit.get("checks")
        if not isinstance(checks, list) or not checks:
            raise ValueError(f"{unit_id}: acceptance checks required.")
        keys = [check.get("id") for check in checks]
        if len(set(keys)) != len(keys) or not all(isinstance(x, str) and x for x in keys):
            raise ValueError(f"{unit_id}: duplicate or invalid check ID.")
        for check in checks:
            value = check.get("verified")
            if type(value) is not bool or not check.get("label"):
                raise ValueError(f"{unit_id}/{check.get('id')}: explicit boolean and label required.")
            refs = check.get("evidence")
            if value is True:
                if isinstance(refs, str):
                    refs = [refs]
                if not isinstance(refs, list) or not refs or not all(
                    isinstance(ref, str) and ref.startswith(("docs/", "tests/", "app/")) and
                    (ROOT / ref).is_file() for ref in refs
                ):
                    raise ValueError(f"{unit_id}/{check['id']}: verified check lacks repo evidence.")
            elif refs:
                raise ValueError(f"{unit_id}/{check['id']}: pending check must not claim evidence.")
        passed = verified_count(unit)
        if passed == len(checks) and all_units[unit_id]["status"] != "complete":
            raise ValueError(f"{unit_id}: all checks passed but status not reconciled.")
        if all_units[unit_id]["status"] == "not_started" and passed != 0:
            raise ValueError(f"{unit_id}: not_started cannot claim passed checks.")


def render(data: dict) -> str:
    lines = [
        START,
        "## Pending task acceptance progress — evidence-based",
        "",
        "Each percentage = **verified acceptance checks / defined checks**, rounded to "
        "the nearest whole percent. This measures acceptance evidence coverage, **not "
        "engineering effort or deployment readiness**. Closed units are excluded. "
        "Live remains held.",
        "",
        "| Task | Verified checks | Progress bar | % | Next unverified gate |",
        "| --- | ---: | --- | ---: | --- |",
    ]
    for unit in data["units"]:
        checks = unit["checks"]
        done = verified_count(unit)
        total = len(checks)
        progress = percent(done, total)
        filled = (done * 20 + total) // (2 * total)
        bar = "█" * filled + "░" * (10 - filled)
        next_gate = next(check["label"] for check in checks if check["verified"] is False)
        lines.append(
            f"| {unit['id']} — {unit['title']} | {done}/{total} | "
            f"`{bar}` | **{progress}%** | {next_gate} |"
        )
    lines += [
        "",
        f"**Overall verified complete: {data['overall_verified_complete']}/"
        f"{data['overall_total']} ("
        f"{percent(data['overall_verified_complete'], data['overall_total'])}%).** "
        "This overall figure counts only fully closed units; pending-gate progress "
        "must not be added to it.",
        "",
        "Full gate definitions and evidence references: "
        "[pending acceptance progress](config/ai/pending-acceptance-progress.json).",
        END,
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--check", action="store_true")
    group.add_argument("--write", action="store_true")
    args = parser.parse_args()

    data, plan = read_json(PROGRESS), read_json(PLAN)
    validate(data, plan)
    expected = render(data)
    content = README.read_text(encoding="utf-8")
    if START in content and END in content:
        begin = content.index(START)
        end = content.index(END) + len(END)
        actual = content[begin:end]
        if args.check and actual != expected:
            raise SystemExit("README acceptance bars are stale. Run --write and commit.")
        if args.write:
            README.write_text(content[:begin] + expected + content[end:], encoding="utf-8")
    elif args.check:
        raise SystemExit("README acceptance-bar markers missing. Run --write.")
    elif START not in content and END not in content:
        anchor = "## Previous engineering checkpoint — 2026-10-14"
        if anchor not in content:
            raise SystemExit("README progress section anchor missing.")
        README.write_text(
            content.replace(anchor, expected + "\n\n" + anchor, 1),
            encoding="utf-8",
        )
    else:
        raise SystemExit("README has unmatched acceptance-bar markers.")
    print("meta_pending_acceptance_progress=pass")


if __name__ == "__main__":
    main()
