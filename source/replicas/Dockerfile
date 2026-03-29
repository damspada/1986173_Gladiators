# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Disable stdout/stderr buffering so print() output appears immediately in Docker logs
ENV PYTHONUNBUFFERED=1

# Set the working directory in the container
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the current directory contents into the container
COPY . .

# Inform Docker that the container listens on the specified port at runtime
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]