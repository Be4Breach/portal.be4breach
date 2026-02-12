import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_DETAILS = os.getenv("MONGO_URI", "mongodb://localhost:27017")

client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_DETAILS)

database = client.be4breach

user_collection = database.get_collection("users")

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
