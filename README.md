# Be4Breach Portal

## Installation

### Prerequisites

- Node.js (v18+)
- Python (v3.8+)
- MongoDB

### Backend Setup

1. Navigate to backend directory:

```bash
cd backend
```

2. Create virtual environment:

```bash
python -m venv venv
```

3. Activate virtual environment:

```bash
# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

4. Install dependencies:

```bash
pip install -r requirements.txt
```

5. Create `.env` file with:

```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=be4breach
SECRET_KEY=your-secret-key-here
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

6. Run the server:

```bash
uvicorn app.main:app --reload
```

Backend will run on `http://localhost:8000`

### Frontend Setup

1. Navigate to frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env` file with:

```env
VITE_API_URL=http://localhost:8000
```

4. Run the development server:

```bash
npm run dev
```

Frontend will run on `http://localhost:5173`
