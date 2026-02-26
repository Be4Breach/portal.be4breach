import asyncio
import logging
import time
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.models import UnifiedIdentity, IdentitySource

logger = logging.getLogger(__name__)

class RateLimiter:
    def __init__(self, requests_per_second: float):
        self.delay = 1.0 / requests_per_second
        self.last_request = 0.0

    async def wait(self):
        elapsed = time.time() - self.last_request
        if elapsed < self.delay:
            await asyncio.sleep(self.delay - elapsed)
        self.last_request = time.time()

class BaseConnector(ABC):
    def __init__(self, source: IdentitySource, credentials: Dict[str, Any], requests_per_second: float = 5.0):
        self.source = source
        self.credentials = credentials
        self.retry_limit = 3
        self.base_delay = 1.0
        self.rate_limiter = RateLimiter(requests_per_second)

    @abstractmethod
    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        """Fetch raw identity data from the provider."""
        pass

    @abstractmethod
    def normalize(self, raw_data: Dict[str, Any]) -> UnifiedIdentity:
        """Normalize provider-specific data into UnifiedIdentity schema."""
        pass

    async def sync(self) -> List[UnifiedIdentity]:
        """Perform sync with rate limiting, retry logic, and error handling."""
        for attempt in range(self.retry_limit):
            try:
                await self.rate_limiter.wait()
                raw_identities = await self.fetch_raw_data()
                normalized_identities = [self.normalize(data) for data in raw_identities]
                return normalized_identities
            except Exception as e:
                delay = self.base_delay * (2 ** attempt)
                logger.error(f"Error syncing {self.source} (attempt {attempt+1}/{self.retry_limit}): {str(e)}")
                if attempt < self.retry_limit - 1:
                    await asyncio.sleep(delay)
                else:
                    logger.critical(f"Final sync failure for {self.source}: {str(e)}")
                    raise e
        return []
