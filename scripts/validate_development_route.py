#!/usr/bin/env python3
"""Fail closed on PR routes that bypass the development branch."""
import argparse


def validate_route(base: str, head: str, head_repo: str = "", repository: str = "") -> None:
    if base == "main":
        if head != "development" or (repository and head_repo != repository):
            raise ValueError("Only development may open a release PR into main.")
    elif base == "development":
        if head in {"main", "development"}:
            raise ValueError("Feature PRs into development require a separate source branch.")
    else:
        raise ValueError(f"Unsupported PR base branch: {base!r}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--head-repo", required=True)
    parser.add_argument("--repository", required=True)
    args = parser.parse_args()
    validate_route(args.base, args.head, args.head_repo, args.repository)
    print(f"development_route=pass base={args.base} head={args.head}")


if __name__ == "__main__":
    main()
