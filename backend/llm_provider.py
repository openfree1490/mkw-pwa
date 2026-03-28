"""
MKW LLM Provider Layer — Multi-provider with cascading fallback.
Groq (primary) → Gemini (fallback) → Cerebras (second fallback).
All use OpenAI-compatible chat completions API via raw requests.
Zero dependencies beyond `requests` (already in requirements).
"""

import os
import json
import time
import logging
import threading
from typing import Generator, Optional

import requests

log = logging.getLogger("mkw.llm")

# ─────────────────────────────────────────────
# PROVIDER CONFIGURATION
# ─────────────────────────────────────────────
PROVIDERS = {
    "groq": {
        "name": "Groq",
        "base_url": "https://api.groq.com/openai/v1/chat/completions",
        "key_env": "GROQ_API_KEY",
        "model": "llama-3.3-70b-versatile",
        "reasoning_model": "deepseek-r1-distill-llama-70b",
        "max_rpm": 30,
        "context_window": 128000,
    },
    "gemini": {
        "name": "Gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        "key_env": "GEMINI_API_KEY",
        "model": "gemini-2.5-flash",
        "reasoning_model": "gemini-2.5-flash",
        "max_rpm": 10,
        "context_window": 1000000,
    },
    "cerebras": {
        "name": "Cerebras",
        "base_url": "https://api.cerebras.ai/v1/chat/completions",
        "key_env": "CEREBRAS_API_KEY",
        "model": "llama-3.3-70b",
        "reasoning_model": "llama-3.3-70b",
        "max_rpm": 30,
        "context_window": 64000,
    },
}

# Priority order for fallback
PROVIDER_ORDER = ["groq", "gemini", "cerebras"]


# ─────────────────────────────────────────────
# RATE LIMITER (per-provider, thread-safe)
# ─────────────────────────────────────────────
class RateLimiter:
    def __init__(self, max_rpm: int):
        self.max_rpm = max_rpm
        self.timestamps: list = []
        self.lock = threading.Lock()

    def acquire(self) -> bool:
        """Return True if request is allowed, False if rate-limited."""
        now = time.time()
        with self.lock:
            # Remove timestamps older than 60s
            self.timestamps = [t for t in self.timestamps if now - t < 60]
            if len(self.timestamps) >= self.max_rpm:
                return False
            self.timestamps.append(now)
            return True

    def wait_time(self) -> float:
        """Return seconds to wait before next request is allowed."""
        now = time.time()
        with self.lock:
            self.timestamps = [t for t in self.timestamps if now - t < 60]
            if len(self.timestamps) < self.max_rpm:
                return 0.0
            return 60.0 - (now - self.timestamps[0]) + 0.1


_rate_limiters = {k: RateLimiter(v["max_rpm"]) for k, v in PROVIDERS.items()}


# ─────────────────────────────────────────────
# CIRCUIT BREAKER (per-provider)
# ─────────────────────────────────────────────
_circuit_breakers = {
    k: {"failures": 0, "last_failure": 0, "is_open": False}
    for k in PROVIDERS
}
CIRCUIT_THRESHOLD = 5
CIRCUIT_TIMEOUT = 30 * 60  # 30 min cooldown


def _is_circuit_open(provider: str) -> bool:
    cb = _circuit_breakers[provider]
    if not cb["is_open"]:
        return False
    if time.time() - cb["last_failure"] > CIRCUIT_TIMEOUT:
        cb["is_open"] = False
        cb["failures"] = 0
        return False  # Half-open: allow retry
    return True


def _record_success(provider: str):
    cb = _circuit_breakers[provider]
    cb["failures"] = 0
    cb["is_open"] = False


def _record_failure(provider: str):
    cb = _circuit_breakers[provider]
    cb["failures"] += 1
    cb["last_failure"] = time.time()
    if cb["failures"] >= CIRCUIT_THRESHOLD:
        cb["is_open"] = True
        log.warning(f"Circuit breaker OPEN for {PROVIDERS[provider]['name']}")


# ─────────────────────────────────────────────
# RESPONSE CACHE (simple in-memory, TTL 10 min)
# ─────────────────────────────────────────────
_cache: dict = {}
_cache_lock = threading.Lock()
CACHE_TTL = 600  # 10 minutes


def _cache_key(messages: list) -> str:
    """Hash the last user message for caching."""
    import hashlib
    last_user = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            last_user = m["content"]
            break
    return hashlib.md5(last_user.encode()).hexdigest()


def _cache_get(key: str) -> Optional[str]:
    with _cache_lock:
        entry = _cache.get(key)
        if entry and time.time() - entry["ts"] < CACHE_TTL:
            return entry["text"]
        return None


def _cache_set(key: str, text: str):
    with _cache_lock:
        _cache[key] = {"text": text, "ts": time.time()}
        # Evict old entries
        if len(_cache) > 200:
            oldest = sorted(_cache.items(), key=lambda x: x[1]["ts"])[:50]
            for k, _ in oldest:
                _cache.pop(k, None)


# ─────────────────────────────────────────────
# CORE: STREAMING COMPLETION
# ─────────────────────────────────────────────
def stream_completion(
    messages: list,
    use_reasoning: bool = False,
    max_tokens: int = 2000,
    temperature: float = 0.7,
) -> Generator[dict, None, None]:
    """
    Stream chat completion with cascading fallback across providers.
    Yields dicts: {"type": "provider", "provider": "Groq"}
                  {"type": "content", "content": "..."}
                  {"type": "done"}
                  {"type": "error", "error": "..."}
    """
    for provider_key in PROVIDER_ORDER:
        config = PROVIDERS[provider_key]
        api_key = os.environ.get(config["key_env"], "")
        if not api_key:
            continue
        if _is_circuit_open(provider_key):
            continue
        if not _rate_limiters[provider_key].acquire():
            log.info(f"{config['name']} rate limited, trying next")
            continue

        model = config["reasoning_model"] if use_reasoning else config["model"]

        try:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            body = {
                "model": model,
                "messages": messages,
                "stream": True,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }

            resp = requests.post(
                config["base_url"],
                headers=headers,
                json=body,
                stream=True,
                timeout=60,
            )

            if resp.status_code == 429:
                log.info(f"{config['name']} 429 rate limited")
                _record_failure(provider_key)
                continue

            if resp.status_code != 200:
                log.warning(f"{config['name']} HTTP {resp.status_code}: {resp.text[:200]}")
                _record_failure(provider_key)
                continue

            # Success — yield provider info
            _record_success(provider_key)
            yield {"type": "provider", "provider": config["name"]}

            # Stream SSE chunks
            for line in resp.iter_lines(decode_unicode=True):
                if not line:
                    continue
                if not line.startswith("data: "):
                    continue
                data_str = line[6:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield {"type": "content", "content": content}
                except (json.JSONDecodeError, IndexError, KeyError):
                    continue

            yield {"type": "done"}
            return  # Success — don't try other providers

        except requests.exceptions.Timeout:
            log.warning(f"{config['name']} timeout")
            _record_failure(provider_key)
            continue
        except Exception as e:
            log.warning(f"{config['name']} error: {e}")
            _record_failure(provider_key)
            continue

    # All providers exhausted
    yield {"type": "error", "error": "All AI providers are temporarily unavailable. Please try again in a few minutes."}


def get_completion(
    messages: list,
    use_reasoning: bool = False,
    max_tokens: int = 2000,
) -> tuple:
    """
    Non-streaming completion. Returns (text, provider_name).
    """
    # Check cache
    key = _cache_key(messages)
    cached = _cache_get(key)
    if cached:
        return cached, "cache"

    full_text = ""
    provider_name = "unknown"

    for chunk in stream_completion(messages, use_reasoning, max_tokens):
        if chunk["type"] == "provider":
            provider_name = chunk["provider"]
        elif chunk["type"] == "content":
            full_text += chunk["content"]
        elif chunk["type"] == "error":
            return chunk["error"], "error"

    if full_text:
        _cache_set(key, full_text)

    return full_text, provider_name


# ─────────────────────────────────────────────
# STATUS
# ─────────────────────────────────────────────
def get_provider_status() -> dict:
    """Return status of all providers for the UI."""
    status = {}
    for key in PROVIDER_ORDER:
        config = PROVIDERS[key]
        has_key = bool(os.environ.get(config["key_env"], ""))
        cb = _circuit_breakers[key]
        rl = _rate_limiters[key]
        status[key] = {
            "name": config["name"],
            "configured": has_key,
            "circuit_open": cb["is_open"],
            "failures": cb["failures"],
            "requests_remaining": max(0, rl.max_rpm - len([t for t in rl.timestamps if time.time() - t < 60])),
        }
    return status
