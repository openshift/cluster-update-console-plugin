#!/usr/bin/env python3
"""Generate TypeScript types from Kubernetes CRD OpenAPI schemas.

Usage:
    python3 hack/generate-types.py                         # from live cluster
    python3 hack/generate-types.py --from-dir crds/        # from local CRD YAML files

Generates src/models/generated/*.ts with TypeScript interfaces matching
the CRD spec and status schemas.
"""

import json
import os
import subprocess
import sys
import textwrap
from pathlib import Path

CRDS = {
    "proposals.agentic.openshift.io": "Proposal",
    "proposalapprovals.agentic.openshift.io": "ProposalApproval",
    "approvalpolicies.agentic.openshift.io": "ApprovalPolicy",
    "analysisresults.agentic.openshift.io": "AnalysisResult",
}

OUT_DIR = Path(__file__).resolve().parent.parent / "src" / "models" / "generated"
BANNER = "// Auto-generated from CRD — do not edit manually.\n// Regenerate with: make generate-types\n"


def extract_from_cluster() -> dict[str, dict]:
    schemas = {}
    for crd_name in CRDS:
        print(f"  Extracting {crd_name}...")
        result = subprocess.run(
            ["oc", "get", "crd", crd_name, "-o",
             "jsonpath={.spec.versions[0].schema.openAPIV3Schema}"],
            capture_output=True, text=True, check=True,
        )
        schemas[crd_name] = json.loads(result.stdout)
    return schemas


def extract_from_dir(d: str) -> dict[str, dict]:
    import yaml
    schemas = {}
    for crd_name in CRDS:
        for f in Path(d).glob("*.yaml"):
            with open(f) as fh:
                doc = yaml.safe_load(fh)
            if doc and doc.get("metadata", {}).get("name") == crd_name:
                schemas[crd_name] = doc["spec"]["versions"][0]["schema"]["openAPIV3Schema"]
                print(f"  {f.name} -> {crd_name}")
                break
        else:
            print(f"  WARNING: {crd_name} not found in {d}")
    return schemas


def schema_to_ts(schema: dict, indent: int = 0) -> str:
    """Convert an OpenAPI schema object to a TypeScript type string."""
    pad = "  " * indent

    if "x-kubernetes-preserve-unknown-fields" in schema:
        return "Record<string, unknown>"

    typ = schema.get("type", "object")

    if "enum" in schema:
        return " | ".join(f"'{v}'" for v in schema["enum"])

    if typ == "string":
        fmt = schema.get("format", "")
        if fmt in ("date-time", "date"):
            return "string"
        return "string"

    if typ == "integer":
        return "number"

    if typ == "number":
        return "number"

    if typ == "boolean":
        return "boolean"

    if typ == "array":
        items = schema.get("items", {})
        item_type = schema_to_ts(items, indent)
        return f"({item_type})[]"

    if typ == "object":
        props = schema.get("properties", {})
        if not props:
            additional = schema.get("additionalProperties")
            if additional and isinstance(additional, dict):
                val_type = schema_to_ts(additional, indent)
                return f"Record<string, {val_type}>"
            return "Record<string, unknown>"

        required = set(schema.get("required", []))
        lines = ["{"]
        for name, prop_schema in sorted(props.items()):
            desc = prop_schema.get("description", "")
            optional = "?" if name not in required else ""
            prop_type = schema_to_ts(prop_schema, indent + 1)
            if desc:
                short = desc.replace("\n", " ").strip()
                if len(short) > 100:
                    short = short[:97] + "..."
                lines.append(f"{pad}  /** {short} */")
            lines.append(f"{pad}  {name}{optional}: {prop_type};")
        lines.append(f"{pad}}}")
        return "\n".join(lines)

    return "unknown"


def generate_one(crd_name: str, type_name: str, schema: dict) -> str:
    """Generate TypeScript for a single CRD."""
    lines = [BANNER, ""]

    props = schema.get("properties", {})
    spec_schema = props.get("spec", {})
    status_schema = props.get("status", {})

    # Generate Spec type
    if spec_schema.get("properties"):
        spec_ts = schema_to_ts(spec_schema, 0)
        lines.append(f"export type {type_name}Spec = {spec_ts};\n")

    # Generate Status type
    if status_schema.get("properties"):
        status_ts = schema_to_ts(status_schema, 0)
        lines.append(f"export type {type_name}Status = {status_ts};\n")

    # Generate nested types that are reusable (conditions, steps, etc.)
    # Extract any deeply nested object types that appear in spec or status

    return "\n".join(lines)


def main():
    if len(sys.argv) > 2 and sys.argv[1] == "--from-dir":
        schemas = extract_from_dir(sys.argv[2])
    else:
        print("Extracting CRD schemas from cluster...")
        schemas = extract_from_cluster()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for crd_name, schema in schemas.items():
        type_name = CRDS[crd_name]
        out_file = OUT_DIR / f"{crd_name.split('.')[0]}.ts"
        print(f"  Generating {out_file.name} ({type_name})...")

        ts_code = generate_one(crd_name, type_name, schema)
        out_file.write_text(ts_code)

    # Barrel export
    barrel = OUT_DIR / "index.ts"
    barrel_lines = [BANNER, ""]
    for crd_name in schemas:
        base = crd_name.split(".")[0]
        barrel_lines.append(f"export * from './{base}';")
    barrel_lines.append("")
    barrel.write_text("\n".join(barrel_lines))

    print(f"Done. Generated types in {OUT_DIR}")


if __name__ == "__main__":
    main()
