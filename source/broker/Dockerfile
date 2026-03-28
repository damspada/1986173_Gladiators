FROM golang:alpine AS build
WORKDIR /app
COPY go.mod ./
COPY *.go ./
RUN go mod tidy && CGO_ENABLED=0 go build -o broker .

FROM alpine:3.19
WORKDIR /app
COPY --from=build /app/broker .
EXPOSE 9090
CMD ["./broker"]
