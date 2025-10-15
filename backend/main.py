from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import PyPDF2
import io
import os
from typing import Optional

app = FastAPI(title="PDF Summarizer API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React app URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "orca-mini")  # You can change this to any model you have
# For faster processing, try: "orca-mini", "mistral", or "phi"

class TextRequest(BaseModel):
    text: str

class SummaryResponse(BaseModel):
    summary: str
    original_length: int
    summary_length: int

def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text from PDF file content."""
    try:
        pdf_file = io.BytesIO(file_content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        
        return text.strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error extracting text from PDF: {str(e)}")

def summarize_with_ollama(text: str) -> str:
    """Summarize text using Ollama."""
    try:
        # Prepare the prompt for summarization
        prompt = f"""Please provide a concise summary of the following text. Focus on the main points and key information:

{text}

Summary:"""

        # Make request to Ollama
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,  # Lower temperature for more focused summaries
                    "top_p": 0.9,
                    "max_tokens": 1000  # Limit summary length
                }
            },
            timeout=300  # 5 minute timeout for large documents
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=500, 
                detail=f"Ollama API error: {response.status_code} - {response.text}"
            )
        
        result = response.json()
        return result.get("response", "").strip()
        
    except requests.exceptions.Timeout as e:
        raise HTTPException(
            status_code=504, 
            detail=f"Ollama request timed out. The model might be processing a large document. Try with a smaller text or a faster model like 'orca-mini'."
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to connect to Ollama: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error during summarization: {str(e)}"
        )

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"message": "PDF Summarizer API is running", "ollama_model": OLLAMA_MODEL}

@app.get("/health")
async def health_check():
    """Check if Ollama is accessible."""
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        if response.status_code == 200:
            return {"status": "healthy", "ollama_accessible": True}
        else:
            return {"status": "unhealthy", "ollama_accessible": False}
    except:
        return {"status": "unhealthy", "ollama_accessible": False}

@app.post("/upload-pdf", response_model=SummaryResponse)
async def upload_pdf(file: UploadFile = File(...)):
    """Upload and summarize a PDF file."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Read file content
    file_content = await file.read()
    
    if len(file_content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    
    # Extract text from PDF
    extracted_text = extract_text_from_pdf(file_content)
    
    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="No text found in PDF")
    
    # Summarize using Ollama
    summary = summarize_with_ollama(extracted_text)
    
    return SummaryResponse(
        summary=summary,
        original_length=len(extracted_text),
        summary_length=len(summary)
    )

@app.post("/summarize-text", response_model=SummaryResponse)
async def summarize_text(request: TextRequest):
    """Summarize provided text."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    # Summarize using Ollama
    summary = summarize_with_ollama(request.text)
    
    return SummaryResponse(
        summary=summary,
        original_length=len(request.text),
        summary_length=len(summary)
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
