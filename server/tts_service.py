"""Text-to-speech — OpenAI (optional) or free Edge / gTTS (no API key)."""

from __future__ import annotations

import asyncio
import io
import logging
import os
import re
from typing import Any, Literal

import httpx

logger = logging.getLogger(__name__)

OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech"
OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"

Provider = Literal["openai", "edge", "gtts"]

GTTS_LANGUAGE: dict[str, tuple[str, str]] = {
    "en-US": ("en", "com"),
    "en-GB": ("en", "co.uk"),
    "es-ES": ("es", "es"),
    "fr-FR": ("fr", "fr"),
    "de-DE": ("de", "de"),
    "it-IT": ("it", "it"),
    "pt-BR": ("pt", "com.br"),
    "ja-JP": ("ja", "co.jp"),
    "ur-PK": ("ur", "com.pk"),
}

VOICE_PROFILES: dict[str, dict[str, Any]] = {
    "baby": {"openai_voice": "nova", "speed_offset": 0.15, "prefix": ""},
    "boy": {"openai_voice": "echo", "speed_offset": 0.08, "prefix": ""},
    "girl": {"openai_voice": "shimmer", "speed_offset": 0.05, "prefix": ""},
    "man": {"openai_voice": "onyx", "speed_offset": -0.05, "prefix": ""},
    "woman": {"openai_voice": "nova", "speed_offset": 0.0, "prefix": ""},
    "old_man": {"openai_voice": "fable", "speed_offset": -0.12, "prefix": ""},
    "old_woman": {"openai_voice": "alloy", "speed_offset": -0.08, "prefix": ""},
    "robot": {"openai_voice": "echo", "speed_offset": -0.1, "prefix": ""},
}

# Microsoft Edge neural voices — free, no API key
EDGE_VOICE_BY_STYLE: dict[str, dict[str, str]] = {
    "baby": {"voice": "en-US-AnaNeural", "pitch": "+12Hz"},
    "boy": {"voice": "en-US-GuyNeural", "pitch": "+4Hz"},
    "girl": {"voice": "en-US-JennyNeural", "pitch": "+2Hz"},
    "man": {"voice": "en-US-ChristopherNeural", "pitch": "-2Hz"},
    "woman": {"voice": "en-US-AriaNeural", "pitch": "+0Hz"},
    "old_man": {"voice": "en-US-EricNeural", "pitch": "-6Hz"},
    "old_woman": {"voice": "en-US-SaraNeural", "pitch": "-4Hz"},
    "robot": {"voice": "en-US-AndrewMultilingualNeural", "pitch": "-8Hz"},
}

EDGE_LANGUAGE_VOICES: dict[str, str] = {
    "en-US": "en-US-AriaNeural",
    "en-GB": "en-GB-SoniaNeural",
    "es-ES": "es-ES-ElviraNeural",
    "fr-FR": "fr-FR-DeniseNeural",
    "de-DE": "de-DE-KatjaNeural",
    "it-IT": "it-IT-ElsaNeural",
    "pt-BR": "pt-BR-FranciscaNeural",
    "ja-JP": "ja-JP-NanamiNeural",
    "ur-PK": "ur-PK-UzmaNeural",
}

# Per-style voices when a language has male/female neural options
EDGE_VOICES_BY_LANG_AND_STYLE: dict[str, dict[str, str]] = {
    "ur-PK": {
        "baby": "ur-PK-UzmaNeural",
        "boy": "ur-PK-AsadNeural",
        "girl": "ur-PK-UzmaNeural",
        "man": "ur-PK-AsadNeural",
        "woman": "ur-PK-UzmaNeural",
        "old_man": "ur-PK-AsadNeural",
        "old_woman": "ur-PK-UzmaNeural",
        "robot": "ur-PK-AsadNeural",
    },
}

EMOTION_RATE_OFFSET: dict[str, float] = {
    "happy": 0.08,
    "sad": -0.12,
    "excited": 0.15,
    "calm": 0.0,
    "angry": 0.05,
}

EMOTION_HINTS: dict[str, str] = {
    "happy": "Deliver with a warm, upbeat tone. ",
    "sad": "Deliver with a soft, melancholic tone. ",
    "excited": "Deliver with high energy and enthusiasm. ",
    "calm": "Deliver in a relaxed, soothing manner. ",
    "angry": "Deliver with firm, intense emphasis. ",
}

LANGUAGE_HINTS: dict[str, str] = {
    "en-US": "",
    "en-GB": "Use British English pronunciation. ",
    "es-ES": "Speak in European Spanish. ",
    "fr-FR": "Speak in French. ",
    "de-DE": "Speak in German. ",
    "it-IT": "Speak in Italian. ",
    "pt-BR": "Speak in Brazilian Portuguese. ",
    "ja-JP": "Speak in Japanese. ",
    "ur-PK": "Speak in Pakistani Urdu. ",
}


class TTSService:
    def __init__(self) -> None:
        self.api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.model = os.getenv("OPENAI_TTS_MODEL", "tts-1-hd").strip() or "tts-1-hd"
        self.enhance_model = os.getenv("OPENAI_ENHANCE_MODEL", "gpt-4o-mini").strip()
        requested = os.getenv("TTS_PROVIDER", "auto").strip().lower()
        if requested == "openai":
            self._provider: Provider = "openai"
        elif requested in ("edge", "gtts"):
            self._provider = requested  # type: ignore[assignment]
        else:
            self._provider = "openai" if self.api_key else "edge"

        self._last_provider: Provider = self._provider

    @property
    def provider(self) -> Provider:
        return self._last_provider if self._provider != "openai" else "openai"

    @property
    def is_configured(self) -> bool:
        return self._provider in ("edge", "gtts") or bool(self.api_key)

    @property
    def uses_free_tier(self) -> bool:
        return self._provider in ("edge", "gtts")

    def _clamp_speed(self, speed: float) -> float:
        return max(0.25, min(4.0, speed))

    def _speed_to_rate(self, speed: float) -> str:
        percent = int(round((speed - 1.0) * 100))
        percent = max(-50, min(100, percent))
        return f"{percent:+d}%"

    def _pitch_to_hz(self, pitch: float, base: str = "+0Hz") -> str:
        base_val = 0
        if base.endswith("Hz"):
            try:
                base_val = int(base.replace("Hz", "").replace("+", ""))
            except ValueError:
                base_val = 0
        delta = int(round((pitch - 1.0) * 20))
        total = max(-20, min(20, base_val + delta))
        return f"{total:+d}Hz"

    def _build_input_text(
        self,
        text: str,
        voice_id: str,
        emotion: str,
        language: str,
        pitch: float,
        *,
        for_openai: bool,
    ) -> str:
        cleaned = text.strip()
        if not cleaned:
            raise ValueError("Text cannot be empty.")

        if not for_openai:
            return cleaned

        profile = VOICE_PROFILES.get(voice_id, VOICE_PROFILES["woman"])
        parts: list[str] = []

        lang_hint = LANGUAGE_HINTS.get(language, "")
        if lang_hint:
            parts.append(lang_hint)

        emotion_hint = EMOTION_HINTS.get(emotion, "")
        if emotion_hint:
            parts.append(emotion_hint)

        if voice_id == "robot":
            parts.append("Speak in a slightly mechanical, synthetic cadence. ")

        if pitch > 1.15:
            parts.append("Use a noticeably higher vocal register. ")
        elif pitch < 0.85:
            parts.append("Use a noticeably lower vocal register. ")

        prefix = profile.get("prefix", "")
        if prefix:
            parts.append(prefix)

        return "".join(parts) + cleaned

    async def enhance_text(self, text: str) -> str:
        if not self.api_key:
            return text.strip()

        payload = {
            "model": self.enhance_model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Rewrite the user's text for natural text-to-speech delivery. "
                        "Keep meaning and language. Return only the rewritten text, no quotes."
                    ),
                },
                {"role": "user", "content": text},
            ],
            "temperature": 0.4,
            "max_tokens": 1024,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                OPENAI_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        content = data["choices"][0]["message"]["content"].strip()
        return re.sub(r'^["\']|["\']$', "", content) or text

    async def _synthesize_openai(
        self,
        *,
        text: str,
        voice_id: str,
        speed: float,
        pitch: float,
        emotion: str,
        language: str,
        ai_enhancement: bool,
    ) -> tuple[bytes, str]:
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY is not set.")

        working_text = text.strip()
        if ai_enhancement:
            working_text = await self.enhance_text(working_text)

        input_text = self._build_input_text(
            working_text, voice_id, emotion, language, pitch, for_openai=True
        )

        profile = VOICE_PROFILES.get(voice_id, VOICE_PROFILES["woman"])
        pitch_factor = 0.85 + (pitch - 1.0) * 0.3
        effective_speed = speed + profile["speed_offset"] + (pitch_factor - 1.0) * 0.2
        effective_speed = self._clamp_speed(effective_speed)

        payload = {
            "model": self.model,
            "input": input_text[:4096],
            "voice": profile["openai_voice"],
            "response_format": "mp3",
            "speed": round(effective_speed, 2),
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                OPENAI_TTS_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

            if response.status_code >= 400:
                detail = response.text
                try:
                    detail = response.json().get("error", {}).get("message", detail)
                except Exception:
                    pass
                raise RuntimeError(f"TTS API error: {detail}")

            return response.content, "audio/mpeg"

    async def _synthesize_edge(
        self,
        *,
        text: str,
        voice_id: str,
        speed: float,
        pitch: float,
        emotion: str,
        language: str,
    ) -> tuple[bytes, str]:
        import edge_tts

        style = EDGE_VOICE_BY_STYLE.get(voice_id, EDGE_VOICE_BY_STYLE["woman"])
        lang_voice = EDGE_LANGUAGE_VOICES.get(language)
        lang_styles = EDGE_VOICES_BY_LANG_AND_STYLE.get(language, {})

        if voice_id in lang_styles:
            voice = lang_styles[voice_id]
        elif language != "en-US" and lang_voice:
            voice = lang_voice
        else:
            voice = style["voice"]

        profile = VOICE_PROFILES.get(voice_id, VOICE_PROFILES["woman"])
        emotion_offset = EMOTION_RATE_OFFSET.get(emotion, 0.0)
        effective_speed = speed + profile["speed_offset"] + emotion_offset
        effective_speed = max(0.5, min(2.0, effective_speed))

        rate = self._speed_to_rate(effective_speed)
        pitch_hz = self._pitch_to_hz(pitch, style.get("pitch", "+0Hz"))

        if voice_id == "robot":
            rate = self._speed_to_rate(effective_speed * 0.92)
            pitch_hz = self._pitch_to_hz(0.85, "-8Hz")

        working_text = text.strip()[:4096]
        logger.info("Edge TTS: voice=%s rate=%s pitch=%s", voice, rate, pitch_hz)

        communicate = edge_tts.Communicate(working_text, voice, rate=rate, pitch=pitch_hz)
        chunks: list[bytes] = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])

        if not chunks:
            raise RuntimeError("Edge TTS returned no audio. Check your internet connection.")

        return b"".join(chunks), "audio/mpeg"

    async def _synthesize_gtts(
        self,
        *,
        text: str,
        voice_id: str,
        speed: float,
        emotion: str,
        language: str,
    ) -> tuple[bytes, str]:
        from gtts import gTTS

        lang, tld = GTTS_LANGUAGE.get(language, ("en", "com"))
        profile = VOICE_PROFILES.get(voice_id, VOICE_PROFILES["woman"])
        emotion_offset = EMOTION_RATE_OFFSET.get(emotion, 0.0)
        effective_speed = speed + profile["speed_offset"] + emotion_offset
        slow = effective_speed < 0.92 or voice_id in ("old_man", "old_woman")
        working_text = text.strip()[:4096]

        logger.info("gTTS fallback: lang=%s tld=%s slow=%s", lang, tld, slow)

        def _generate() -> bytes:
            buffer = io.BytesIO()
            gTTS(text=working_text, lang=lang, tld=tld, slow=slow).write_to_fp(buffer)
            return buffer.getvalue()

        audio = await asyncio.to_thread(_generate)
        if not audio:
            raise RuntimeError("gTTS returned no audio.")
        return audio, "audio/mpeg"

    def _edge_error_should_fallback(self, exc: BaseException) -> bool:
        message = str(exc).lower()
        return any(
            token in message
            for token in ("403", "invalid response status", "wsserverhandshake", "blocked")
        )

    async def synthesize(
        self,
        *,
        text: str,
        voice_id: str,
        speed: float = 1.0,
        pitch: float = 1.0,
        emotion: str = "calm",
        language: str = "en-US",
        ai_enhancement: bool = False,
    ) -> tuple[bytes, str]:
        if self._provider == "openai":
            return await self._synthesize_openai(
                text=text,
                voice_id=voice_id,
                speed=speed,
                pitch=pitch,
                emotion=emotion,
                language=language,
                ai_enhancement=ai_enhancement,
            )

        if ai_enhancement and self.api_key:
            text = await self.enhance_text(text)

        if self._provider == "gtts":
            self._last_provider = "gtts"
            return await self._synthesize_gtts(
                text=text,
                voice_id=voice_id,
                speed=speed,
                emotion=emotion,
                language=language,
            )

        try:
            result = await self._synthesize_edge(
                text=text,
                voice_id=voice_id,
                speed=speed,
                pitch=pitch,
                emotion=emotion,
                language=language,
            )
            self._last_provider = "edge"
            return result
        except ImportError as exc:
            logger.warning("edge-tts missing, using gTTS: %s", exc)
        except Exception as exc:
            if not self._edge_error_should_fallback(exc):
                raise
            logger.warning("Edge TTS failed (%s), falling back to gTTS", exc)

        try:
            result = await self._synthesize_gtts(
                text=text,
                voice_id=voice_id,
                speed=speed,
                emotion=emotion,
                language=language,
            )
            self._last_provider = "gtts"
            return result
        except ImportError as exc:
            raise RuntimeError(
                "Voice generation failed. Upgrade edge-tts: pip install -U 'edge-tts>=7.2.7'"
            ) from exc
