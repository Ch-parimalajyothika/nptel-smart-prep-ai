"""
utils/youtube_transcript.py
Fetches auto-generated or manual captions from YouTube using the
youtube-transcript-api library, and can also transcribe audio from any URL.

LEGAL NOTICE:
- We use the official YouTube captions/transcript data only.
- We do NOT download video content.
- We do NOT scrape NPTEL/SWAYAM websites.
- We DO comply with YouTube's Terms of Service by only accessing
  publicly available transcript data that YouTube itself provides.
"""

import re
import os
import tempfile
from typing import Optional, Tuple
from urllib.parse import urlparse


def extract_video_id(url: str) -> Optional[str]:
    """Extract the video ID from various YouTube URL formats."""
    patterns = [
        r"(?:v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})",
    ]
    for pat in patterns:
        m = re.search(pat, url)
        if m:
            return m.group(1)
    return None


def is_youtube_url(url: str) -> bool:
    """Check if the URL is a YouTube URL."""
    parsed = urlparse(url)
    return parsed.netloc in ('www.youtube.com', 'youtube.com', 'youtu.be', 'm.youtube.com')


def fetch_youtube_transcript(url: str) -> Tuple[Optional[str], str]:
    """
    Attempt to fetch a YouTube video transcript.

    Returns: (transcript_text, status_message)
    - transcript_text: the full transcript string, or None if unavailable
    - status_message:  human-readable status

    This function:
    1. Tries English manual captions first
    2. Falls back to auto-generated captions
    3. Falls back to any available language
    4. Returns None with a clear message if none found
    """
    video_id = extract_video_id(url)
    if not video_id:
        return None, "❌ Could not extract video ID from URL. Please check the URL."

    try:
        from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound

        # Try to get transcript list
        try:
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        except TranscriptsDisabled:
            return None, (
                "⚠️ Transcripts are disabled for this video.\n"
                "💡 To continue, please:\n"
                "   1. Download the audio from the video\n"
                "   2. Upload it using the Audio Upload feature\n"
                "   3. We'll transcribe it using Whisper AI"
            )

        # Priority order: manual English → auto English → any available
        transcript = None
        try:
            transcript = transcript_list.find_manually_created_transcript(["en", "en-US", "en-GB"])
        except NoTranscriptFound:
            pass

        if not transcript:
            try:
                transcript = transcript_list.find_generated_transcript(["en", "en-US"])
            except NoTranscriptFound:
                pass

        if not transcript:
            # Try any available language
            try:
                available = list(transcript_list)
                if available:
                    transcript = available[0]
            except Exception:
                pass

        if not transcript:
            return None, (
                "⚠️ No transcript available for this video.\n"
                "💡 Please upload the audio file for Whisper transcription instead."
            )

        # Fetch and format the transcript
        entries   = transcript.fetch()
        full_text = " ".join(entry["text"].strip() for entry in entries if entry.get("text"))
        lang      = getattr(transcript, "language", "unknown")
        is_auto   = getattr(transcript, "is_generated", False)

        status = f"✅ Transcript fetched successfully ({lang}, {'auto-generated' if is_auto else 'manual'}, {len(full_text)} chars)"
        return full_text, status

    except ImportError:
        return None, "❌ youtube-transcript-api not installed. Run: pip install youtube-transcript-api"
    except Exception as e:
        return None, (
            f"⚠️ Could not fetch transcript: {str(e)}\n"
            "💡 Please upload the audio file for Whisper transcription instead."
        )


def download_audio_from_url(url: str) -> Optional[str]:
    """
    Download audio from a URL (YouTube or other video platforms).
    
    Returns the path to the downloaded audio file, or None if failed.
    """
    try:
        import yt_dlp
    except ImportError:
        return None, "❌ yt-dlp not installed. Run: pip install yt-dlp"
    
    temp_dir = tempfile.gettempdir()
    output_path = os.path.join(temp_dir, "downloaded_audio.%(ext)s")
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_path,
        'quiet': True,
        'no_warnings': True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            # Convert to mp3 if needed
            if not filename.endswith('.mp3'):
                try:
                    from pydub import AudioSegment
                    audio = AudioSegment.from_file(filename)
                    mp3_path = filename.rsplit('.', 1)[0] + '.mp3'
                    audio.export(mp3_path, format='mp3')
                    os.remove(filename)  # Remove original file
                    return mp3_path
                except ImportError:
                    # If pydub is not available, return the original file
                    return filename
            return filename
    except Exception as e:
        return None, f"❌ Error downloading audio: {str(e)}"


def transcribe_audio_with_whisper(audio_path: str) -> Tuple[Optional[str], str]:
    """
    Transcribe audio file using Whisper.
    
    Returns: (transcript_text, status_message)
    """
    try:
        import whisper
    except ImportError:
        return None, "❌ Whisper not installed. Run: pip install openai-whisper"
    
    try:
        model = whisper.load_model("base")
        result = model.transcribe(audio_path)
        transcript = result["text"]
        status = f"✅ Audio transcribed successfully with Whisper ({len(transcript)} chars)"
        return transcript, status
    except Exception as e:
        return None, f"❌ Error transcribing audio: {str(e)}"


def summarize_text(text: str, model_name: str = "gpt-3.5-turbo") -> Tuple[Optional[str], str]:
    """
    Summarize text using OpenAI's API.
    
    Returns: (summary_text, status_message)
    """
    try:
        import openai
    except ImportError:
        return None, "❌ OpenAI library not installed. Run: pip install openai"
    
    try:
        # Check if API key is set
        if not os.environ.get("OPENAI_API_KEY"):
            return None, "❌ OpenAI API key not set. Please set the OPENAI_API_KEY environment variable."
        
        # Truncate text if too long (approximate token limit)
        max_chars = 12000  # Approximate limit for GPT-3.5
        if len(text) > max_chars:
            text = text[:max_chars] + "..."
        
        # Create a prompt for summarization
        prompt = f"Please summarize the following text:\n\n{text}\n\nSummary:"
        
        # Call the OpenAI API
        response = openai.ChatCompletion.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that summarizes text accurately and concisely."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500,
            temperature=0.3
        )
        
        summary = response.choices[0].message['content'].strip()
        status = f"✅ Text summarized successfully ({len(summary)} chars)"
        return summary, status
    except Exception as e:
        return None, f"❌ Error summarizing text: {str(e)}"


def fetch_transcript_from_any_url(url: str) -> Tuple[Optional[str], str]:
    """
    Fetch transcript from any URL (YouTube or other).
    
    Returns: (transcript_text, status_message)
    """
    if is_youtube_url(url):
        # Try to get YouTube transcript first
        transcript, status = fetch_youtube_transcript(url)
        if transcript:
            return transcript, status
        
        # If YouTube transcript is not available, download and transcribe
        result = download_audio_from_url(url)
        if isinstance(result, tuple):  # Error occurred
            return result
        
        audio_path = result
        if audio_path:
            transcript, status = transcribe_audio_with_whisper(audio_path)
            # Clean up the temporary audio file
            try:
                os.remove(audio_path)
            except:
                pass
            return transcript, status
        else:
            return None, "❌ Failed to download audio from YouTube URL"
    else:
        # For non-YouTube URLs, try to download and transcribe
        result = download_audio_from_url(url)
        if isinstance(result, tuple):  # Error occurred
            return result
        
        audio_path = result
        if audio_path:
            transcript, status = transcribe_audio_with_whisper(audio_path)
            # Clean up the temporary audio file
            try:
                os.remove(audio_path)
            except:
                pass
            return transcript, status
        else:
            return None, "❌ Failed to download audio from the provided URL"


def process_url(url: str, summarize: bool = True) -> Tuple[Optional[str], Optional[str], str]:
    """
    Process any URL to get transcript and optionally summary.
    
    Returns: (transcript_text, summary_text, status_message)
    """
    # First, try to get the transcript
    transcript, status = fetch_transcript_from_any_url(url)
    if not transcript:
        return None, None, status
    
    # If summarization is requested, generate a summary
    summary = None
    if summarize:
        summary, summary_status = summarize_text(transcript)
        if not summary:
            status = f"{status}\n{summary_status}"
    
    return transcript, summary, status