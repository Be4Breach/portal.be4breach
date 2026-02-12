# Be4Breach Backend

This is the Python/FastAPI backend for Be4Breach.

## Prerequisites

- Python 3.8+
- MongoDB (running locally on default port 27017)

## Setup

1.  Navigate to the backend directory:

    ```bash
    cd backend
    ```

2.  Create a virtual environment (optional but recommended):

    ```bash
    python -m venv venv
    # Linux/Mac
    source venv/bin/activate
    # Windows
    venv\Scripts\activate
    ```

3.  Install dependencies:

    ```bash
    pip install -r requirements.txt
    ```

4.  Create a `.env` file in `backend/` (optional, defaults are set in code):
    ```env
    MONGO_URI=mongodb://localhost:27017
    SECRET_KEY=your_super_secret_key
    ```

## Running the Server

Start the development server:

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.
Docs are available at `http://localhost:8000/docs`.
