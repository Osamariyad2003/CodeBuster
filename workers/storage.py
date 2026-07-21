"""Store review artifacts in MinIO (S3-compatible) or filesystem stub."""
import os
from typing import Optional

from backend.api.config import settings


def put_artifact(key: str, body: bytes) -> Optional[str]:
    """Store artifact; return path or S3 key for reference."""
    if settings.s3_endpoint_url and settings.s3_access_key and settings.s3_secret_key:
        try:
            import boto3
            from botocore.config import Config
            client = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint_url,
                aws_access_key_id=settings.s3_access_key,
                aws_secret_access_key=settings.s3_secret_key,
                config=Config(s3={"addressing_style": "path"}),
                region_name="us-east-1",
            )
            try:
                client.create_bucket(Bucket=settings.s3_bucket)
            except Exception:
                pass  # bucket may already exist
            client.put_object(Bucket=settings.s3_bucket, Key=key, Body=body)
            return key
        except Exception:
            return None
    # Filesystem stub
    stub_dir = os.path.join(os.getcwd(), "artifacts_stub")
    os.makedirs(stub_dir, exist_ok=True)
    path = os.path.join(stub_dir, key.replace("/", "_"))
    with open(path, "wb") as f:
        f.write(body)
    return path
