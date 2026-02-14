import functions_framework
from google.cloud import storage
import re

# The Regex pattern for SOP_PC_001 (Adjust based on your specific naming string)
# Example: YYYYMMDD_ProjectCode_Deliverable_LoD.ext
SOP_PATTERN = r'^\d{8}_[A-Z0-9]+_[A-Za-z0-9]+_LoD\d{3}\.[a-z0-9]+$'

@functions_framework.cloud_event
def validate_naming_convention(cloud_event):
    data = cloud_event.data
    bucket_name = data["bucket"]
    file_name = data["name"]
    
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(file_name)

    # Skip files already in quarantine or system files
    if "quarantine/" in file_name or file_name.startswith('.'):
        return

    # Validate against SOP_PC_001
    if not re.match(SOP_PATTERN, file_name):
        print(f"⚠️ SOP Violation: {file_name}. Moving to quarantine.")
        
        # Move to quarantine
        new_name = f"quarantine/{file_name}"
        bucket.copy_blob(blob, bucket, new_name)
        blob.delete()
        
        # NEXT STEP: Trigger Google Chat Webhook here to alert the team
    else:
        print(f"✅ SOP Compliant: {file_name}. Proceeding to Metadata Extraction.")
        # NEXT STEP: Trigger Dataflow/Vertex AI for point cloud header parsing
