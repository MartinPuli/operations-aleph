"""Verify and sample a rendered v10 master without touching v9 outputs.

Run only after the new render exists. All timing expectations come from the
caller; this script does not reuse the earlier 26-second edit's sample clock.
Paths are relative to the video project unless supplied as absolute paths.

Example:
    python production/verify-v10-output.py \
        --master renders/warden-launch-28s-v10.mp4 \
        --duration 28 --frames 840 --poster 27.45 \
        --timesjson production/v10-sample-times.json

The times JSON must be an array of finite seconds, or {"times": [seconds, ...]}.
Samples and poster must be within the last encoded frame, not at the exclusive
end of the movie. Required tools: ffprobe, ffmpeg and Python with Pillow.

Outputs: snapshots/v10-encoded/, production/final-v10-media-metadata.json,
production/v10-mix-loudness.log, and silent/poster files beside the v10 master.
Encoded-frame capture and loudness measurement do not establish visual approval,
speech intelligibility or pronunciation. Those require separate review.
"""

from pathlib import Path
import argparse
import hashlib
import json
import math
import re
import subprocess
import sys

from PIL import Image, ImageDraw


BASE = Path(__file__).resolve().parent.parent
FPS = 30


def project_path(value):
    path = Path(value)
    return path if path.is_absolute() else BASE / path


def finite_number(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be a number")
    value = float(value)
    if not math.isfinite(value):
        raise ValueError(f"{label} must be finite")
    return value


def run(*args):
    result = subprocess.run(list(args), capture_output=True)
    if result.returncode:
        tail = result.stderr.decode(errors="replace")[-4000:]
        raise RuntimeError(f"{args[0]} exited {result.returncode}:\n{tail}")
    return result


def probe(path):
    return json.loads(run(
        "ffprobe", "-v", "error", "-show_streams", "-show_format",
        "-of", "json", str(path),
    ).stdout)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--master", required=True, help="Existing v10 MP4 path")
    parser.add_argument("--duration", required=True, type=float,
                        help="Expected duration in seconds, on the 30 fps grid")
    parser.add_argument("--frames", required=True, type=int,
                        help="Expected encoded frame count")
    parser.add_argument("--poster", required=True, type=float,
                        help="Poster time in output seconds")
    parser.add_argument("--timesjson", required=True,
                        help="JSON array of output sample times")
    args = parser.parse_args()

    master = project_path(args.master)
    require(master.is_file(), f"Master does not exist: {master}")
    require(re.search(r"(?:^|[-_])v10(?:[-_]|$)", master.stem) is not None,
            "Master filename must contain a v10 version token; v9 is protected")
    duration = finite_number(args.duration, "--duration")
    require(duration > 0 and args.frames > 0,
            "--duration and --frames must be positive")
    require(abs(duration - args.frames / FPS) <= .001,
            "--duration must agree with --frames / 30 within 1 ms")
    last_frame = (args.frames - 1) / FPS

    raw_times = json.loads(project_path(args.timesjson).read_text())
    raw_times = raw_times.get("times") if isinstance(raw_times, dict) else raw_times
    require(isinstance(raw_times, list) and len(raw_times) > 0,
            "--timesjson must contain a nonempty array or an object with times")
    times = [finite_number(t, f"sample {i}") for i, t in enumerate(raw_times)]
    poster = finite_number(args.poster, "--poster")
    for label, value in [(f"sample {i}", t) for i, t in enumerate(times)] + [("poster", poster)]:
        require(0 <= value <= last_frame + 1e-6,
                f"{label} ({value}) is outside 0–{last_frame:.6f} seconds")
    require(times == sorted(times), "Sample times must be in chronological order")

    metadata = probe(master)
    videos = [s for s in metadata["streams"] if s["codec_type"] == "video"]
    audios = [s for s in metadata["streams"] if s["codec_type"] == "audio"]
    require(len(videos) == 1 and len(audios) >= 1,
            "Expected one video stream and at least one audio stream")
    video, audio = videos[0], audios[0]
    require((video.get("width"), video.get("height"), video.get("avg_frame_rate"))
            == (1920, 1080, "30/1"), "Expected 1920 × 1080 at 30 fps")
    require(video.get("codec_name") == "h264" and video.get("pix_fmt") == "yuv420p",
            "Expected H.264 with yuv420p pixels")
    frame_count = video.get("nb_frames")
    if frame_count is None or frame_count == "N/A":
        counted = json.loads(run(
            "ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
            "-show_entries", "stream=nb_read_frames", "-of", "json", str(master),
        ).stdout)
        frame_count = counted["streams"][0]["nb_read_frames"]
    require(int(frame_count) == args.frames,
            f"Expected {args.frames} frames, found {frame_count}")
    actual_duration = finite_number(float(metadata["format"]["duration"]), "media duration")
    require(abs(actual_duration - duration) <= 1 / FPS + .001,
            f"Duration {actual_duration} differs from expected {duration} by over one frame")
    require(audio.get("channels") == 2, "Expected stereo audio")
    require(all(video.get(field) == "bt709" for field in
                ("color_space", "color_transfer", "color_primaries")),
            "Expected BT.709 matrix, transfer and primaries")

    digest = hashlib.sha256()
    with master.open("rb") as media:
        for chunk in iter(lambda: media.read(1024 * 1024), b""):
            digest.update(chunk)
    metadata["sha256"] = digest.hexdigest()
    metadata["verification_inputs"] = {
        "expected_duration": duration, "expected_frames": args.frames,
        "fps": FPS, "poster_time": poster, "sample_times": times,
        "sample_times_source": str(project_path(args.timesjson)),
    }

    output = BASE / "snapshots/v10-encoded"
    output.mkdir(parents=True, exist_ok=True)
    for i, t in enumerate(times):
        run("ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-ss", str(max(0, t - .0001)), "-i", str(master),
            "-frames:v", "1", str(output / f"{i:02d}.png"))
    sheets = []
    for start in range(0, len(times), 12):
        group = times[start:start + 12]
        sheet = Image.new("RGB", (1920, ((len(group) + 2) // 3) * 384), "#171b22")
        draw = ImageDraw.Draw(sheet)
        for i, t in enumerate(group):
            with Image.open(output / f"{start + i:02d}.png") as image:
                thumb = image.convert("RGB").resize((640, 360), Image.Resampling.LANCZOS)
            x, y = i % 3 * 640, i // 3 * 384
            sheet.paste(thumb, (x, y + 24))
            draw.text((x + 10, y + 5), f"{t:.3f}s", fill="white")
        name = f"contact-{start // 12 + 1}.jpg"
        sheet.save(output / name, quality=94)
        sheets.append(name)
    (output / "samples.json").write_text(json.dumps({
        "master": str(master), "sha256": metadata["sha256"],
        "times": times, "contact_sheets": sheets,
    }, indent=2) + "\n")

    silent = master.with_name(f"{master.stem}-silent.mp4")
    poster_path = master.with_name(f"{master.stem}-poster.png")
    run("ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(master),
        "-map", "0:v:0", "-c:v", "copy", "-an", str(silent))
    silent_streams = probe(silent)["streams"]
    require(len(silent_streams) == 1 and silent_streams[0]["codec_type"] == "video",
            "Silent companion must contain only one video stream")
    run("ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", str(max(0, poster - .0001)), "-i", str(master),
        "-frames:v", "1", str(poster_path))
    loudness = run("ffmpeg", "-hide_banner", "-i", str(master),
                   "-af", "ebur128=peak=true", "-vn", "-f", "null", "-")
    (BASE / "production/v10-mix-loudness.log").write_bytes(loudness.stderr)
    (BASE / "production/final-v10-media-metadata.json").write_text(
        json.dumps(metadata, indent=2) + "\n")
    print(f"PASS {duration:g} seconds, {args.frames} frames, Full HD, BT.709, stereo. "
          f"Captured {len(times)} samples. SHA256: {metadata['sha256']}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError, KeyError) as error:
        print(f"Verification failed: {error}", file=sys.stderr)
        sys.exit(1)
