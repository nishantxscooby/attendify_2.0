from fastapi import FastAPI

from .sync.routes import router as sync_router

app = FastAPI()

app.include_router(sync_router, prefix="/sync", tags=["sync"])
