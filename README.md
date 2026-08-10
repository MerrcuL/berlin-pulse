# Berlin Pulse

> Discover everything happening in Berlin — events, transport, news, and community.

Hosted on:
- [Azure](https://berlinpulse-web.calmdesert-277cde2b.switzerlandnorth.azurecontainerapps.io)
- [Home Server](https://berlin.mercul.org) (backup)

A full-stack microservice web application built for the Cloud IT course.

## Architecture

```
Frontend (React + Vite)  →  API Gateway  →  Microservices
                                            ├── Events Service    (kulturdaten.berlin API)
                                            ├── Transport Service (BVG disruptions)
                                            ├── News Service      (Berliner Zeitung RSS)
                                            └── Weather Function  (Open-Meteo API · Serverless)

Azure Blob Storage  ←  Gallery & hero images (cloud-based storage)
```

## Pages

| Page | Description |
|------|-------------|
| **Home** | Dashboard with live clock, weather, transport alerts, news headlines, upcoming events |
| **Events** | Discover Berlin cultural events with search, filtering, pagination |
| **Transport** | BVG disruption reports filtered by U-Bahn, S-Bahn, Tram, Bus, Ferry |
| **News** | Berliner Zeitung RSS feed reader with article cards and thumbnails |
| **Gallery** | Personal Berlin photo gallery with lightbox, zoom, shuffle, and surprise-me |

## Tech Stack

- **Frontend**: React 18, Vite, React Router v6, vanilla CSS
- **Backend**: Node.js, Express.js (4 microservices + gateway)
- **Storage**: Azure Blob Storage (gallery & hero images)
- **Containerization**: Docker + Docker Compose
- **Orchestration**: Kubernetes (manifests in `/k8s`)
- **Serverless**: Weather function (Open-Meteo API)
- **APIs**: kulturdaten.berlin, BVG, Berliner Zeitung RSS, Open-Meteo

## License

MIT
