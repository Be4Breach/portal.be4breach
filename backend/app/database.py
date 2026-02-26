import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_DETAILS = os.getenv("MONGO_URI", "mongodb://localhost:27017")

client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_DETAILS)
database = client.be4breach
DB_AVAILABLE = True  # Flag to track DB status

user_collection = database.get_collection("users")
scans_collection = database.get_collection("scans")
findings_collection = database.get_collection("findings")
audit_collection = database.get_collection("audit")


# Helper function to serialize Mongo document to Pydantic model friendly dict
def user_helper(user) -> dict:
    return {
        "id": str(user["_id"]),
        "first_name": user["first_name"],
        "last_name": user["last_name"],
        "email": user["email"],
        "company_name": user["company_name"],
        "password": user["password"],
        "role": user.get("role", "user"),
        "is_approved": user.get("is_approved", False),
    }

async def init_db():
    """Initialize database indexes with connection check."""
    global DB_AVAILABLE
    try:
        # Check connection with a short timeout
        await client.admin.command('ping', execution_timeout_ms=2000)
        
        identity_collection = database.get_collection("unified_identities")
        await identity_collection.create_index([("email", 1)])
        await identity_collection.create_index([("id", 1)])
        await identity_collection.create_index([("source", 1)])
        await identity_collection.create_index([("riskScore", -1)])
        DB_AVAILABLE = True
        print("Done: Database indexes initialized.")
    except Exception as e:
        DB_AVAILABLE = False
        print(f"Warning: Could not initialize database indexes: {str(e)}")
        # Don't raise, just log the failure and use mock mode
