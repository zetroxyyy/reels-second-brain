# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Prevent Python from writing pyc files to disc and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set the working directory inside the container
WORKDIR /app

# Install native system binaries required for audio processing (ffmpeg) and git downloads (git, curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy main application daemon
COPY main.py /app/

# Set run command to run main.py in unbuffered mode
CMD ["python", "-u", "main.py"]
