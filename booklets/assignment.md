

# Mission Briefing: *A Fragile Balance of Power*

The year is **2038**. The global geopolitical landscape is once again marked by tension, secrecy, and mutual distrust. Even allied nations are reluctant to share sensitive information, especially when it concerns strategic or military activity.

In response, covert operations have deployed **seismic surveillance devices** across strategic locations worldwide. These devices (hereafter referred to as *sensors*) operate in remote and sensitive areas, continuously monitoring ground vibrations.

The intelligence derived from these **signals** is operationally critical. Early detection of threats enables military command to react in time, placing air defense systems on standby, initiating defensive protocols, or escalating readiness levels.

A command center has been established in a **neutral region**. Due to its neutral status, it is strictly prohibited to host cyber services that directly process intelligence data. Only lightweight services that exclusively forward or route data/requests are permitted.

Fortunately, the nation has access to multiple geographically distributed data centers, but they may be abruptly destroyed due to conflict, sabotage, or environmental conditions. Your task is to design and implement a system that can operate reliably under these constraints, providing **continuous intelligence** to the command center even in the presence of **partial system failure**.

**The fate of the nation lies in your hands.**

---

## 📅 General Information

| Item                    | Details                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| **Duration**            | 4 days                                                                  |
| **Team size**           | 2 to 5 students                                                         |
| **Submission deadline** | March 31, 2026, 23:59                                                   |
| **Final discussion**    | In-person presentation + demo (~20 min/group). All members must attend. |

### Suggested Internal Milestones

- **Day 1** – short pitch + user stories draft  
- **Day 2** – architecture defined and event schema defined  
- **Day 3** – full end-to-end system running via Docker Compose  
- **Day 4** – documentation and slides finalized  

---

## 📦 What You Are Provided With

You will receive a **Docker container** simulating a set of seismic sensors. You **must not modify** the provided container.

The simulator exposes a real-time stream of seismic measurements coming from geographically distributed sensors.

### How to Run the Simulator

To start the simulator, first load the image from the provided tar archive and then run the container by publishing port 8080:

```bash
docker load -i seismic-signal-simulator-oci.tar
docker run --rm -p 8080:8080 seismic-signal-simulator:multiarch_v1
```

All endpoints are served from the base URL `http://localhost:8080`.  
The OpenAPI documentation is available at:  

- `http://localhost:8080/docs`  
- `http://localhost:8080/openapi.json`

You can also verify the simulator and list available devices using:

```bash
curl -s http://localhost:8080/health
```

> **Important**: in order to support all architectures, instead of providing an image per architecture, we are providing a multiarch container image. Check [Docker Desktop containerd](https://docs.docker.com/desktop/features/containerd) to learn how to use container images on your local machine.

### Seismic Signal Stream

Devices are discoverable via the devices endpoint:

```bash
curl -s http://localhost:8080/api/devices/ | jq
```

Sensor measurements are exposed **only via WebSocket** (SSE support for sensor streams is not part of the current contract). Subscribe using:

```
WS /api/device/{sensor_id}/ws
```

Each stream message is a time-domain measurement with UTC timestamp and value in mm/s. The default sampling frequency is **20 Hz**, configurable through `SAMPLING_RATE_HZ`.

Additional info can be found in `API_CONTRACT.md`.

### Replica Control Stream (Failure Simulation)

For the purpose of this exam, **only** the processing service replicas are subject to failure. **All other components of the system can be assumed to be reliable**.

Each processing replica must listen to a control stream exposed by the simulator container. This control stream is delivered via Server-Sent Events (SSE) and may emit shutdown commands at random times to simulate node failures.

Control stream endpoint:

```
GET /api/control
```

SSE event types exposed by the simulator are `control-open`, `heartbeat`, and `command`. When a shutdown is triggered, exactly one connected listener receives the shutdown command.

When a replica receives the command:

```json
{"command":"SHUTDOWN"}
```

it must terminate itself (forced shutdown).

Additional info can be found in `API_CONTRACT.md`.

### Development Tools

To aid development, the container has some configurable parameters and API calls to allow manual triggering of events. All related info can be found in `DOCKER_CONTRACT.md` and `http://localhost:8080/docs`.

---

## ✅ What You Must Deliver

You must design and implement a **distributed, fault-tolerant seismic analysis platform** that:

1. Ingests seismic data from the provided simulator  
2. Redistributes each measurement across replicated processing services  
3. Performs frequency-domain analysis and event classification  
4. Persists detected events with duplicate-safe/idempotent behavior  
5. Provides a real-time dashboard for monitoring and exploration  

### Custom Broker Service

You must implement a custom broker (fan-out component) that:

- Captures incoming measurements  
- Redistributes incoming measurements to multiple (some or all, according to your design) processing replicas  

The broker is responsible only for data distribution and must not perform any form of data processing.

For this exam, students can assume that this broker is hosted in the neutral region and does not require replication.

The baseline expectation is that all replicas receive the same stream of events (broadcast model). Partitioning of sensors across replicas is allowed as an optional design choice, provided that the system remains fault tolerant.

### Processing Service (Replicated)

The processing service must run with multiple replicas.

Each replica must:

1. Maintain an in-memory sliding window of recent samples for each sensor  
2. Apply a Discrete Fourier Transform (DFT) or equivalent FFT-based method  
3. Extract dominant frequency components  
4. Classify events based on frequency analysis  

Use the following frequency bands for event classification (based on the dominant frequency component):

| Event Type                 | Frequency Range  |
| -------------------------- | ---------------- |
| **Earthquake**             | 0.5 ≤ f < 3.0 Hz |
| **Conventional explosion** | 3.0 ≤ f < 8.0 Hz |
| **Nuclear-like event**     | f ≥ 8.0 Hz       |

> **Disclaimer**: these frequency references are fictional and are provided only for the purpose of this exam. They do not represent validated real-world seismology thresholds.

### Persistence

Detected events must be stored in a shared persistence layer.

Persistence can be implemented using any relational database (e.g., Postgres) or NoSQL database (e.g., MongoDB). No embedded database (e.g., SQLite) is allowed.

Since replicas may process equivalent inputs, the system must prevent duplicate event persistence.

---

## ⚙️ Functional Requirements

### Gateway and Fault Tolerance

The system must expose a single entry point between dashboard and backend services. Students are free to choose the most appropriate implementation strategy. The chosen entry-point component should:

1. Route requests to available processing replicas  
2. Use health checks to detect unavailable replicas  
3. Exclude failed replicas automatically  

Failure of some replicas must **not** interrupt overall system operation.

### Frontend Dashboard

The frontend must provide a real-time monitoring dashboard with:

- Real-time visualization of detected events  
- Historical event inspection  
- Optional filtering (e.g., by sensor, type, or location)  

Real-time updates must be delivered via WebSocket, SSE, or REST polling.

---

## 🧱 Architectural Constraints

### Mandatory

- Use a distributed architecture (avoid a single monolithic service)  
- Replicate processing services  
- Implement duplicate-safe persistence behavior  
- Provide architecture diagrams  

> **Allowed in this exam scope**: Tight coupling between services is acceptable when clearly justified in the project documentation.

---

## 🛠️ Technical Requirements

### Tech Stack

- **Backend**: any language/framework  
- **Messaging**: external messaging systems (e.g., Kafka, RabbitMQ) are not required  
- **Database**: any relational or NoSQL. No embedded or in-memory databases  

### Containerization

You must provide:

- A Dockerfile per service  
- A single `docker-compose.yml` that starts all services and simulator container  

The system must start with `docker compose up`. No manual setup after startup.

### Baseline Requirements

All groups are expected to meet the following baseline requirements:

1. Distributed architecture  
2. Fault tolerance  
3. Replicated processing services (only component subject to failure)  
4. Sliding-window processing + DFT/FFT analysis  
5. Event classification based on frequency ranges  
6. Duplicate-safe persistent event storage  
7. Real-time dashboard  
8. Docker reproducibility  

### Tasks by Group Size

| Group Size | Expected User Stories |
| ---------- | --------------------- |
| 5          | ~30                   |
| 4          | ~25                   |
| 3          | ~20                   |
| 2          | ~15                   |

> **Note**: user stories must be documented in `input.md`.

---

## 📬 Deliverables

Submit a **public GitHub repository** containing:

- Full source code  
- Dockerfiles, `docker-compose.yml`  
- `input.md`  
- `Student_doc.md`  
- Architecture diagrams  
- User stories + LoFi mockups  
- Presentation slides  

### Repository Structure

```
<MATRICOLA>_<PROJECT>/
├── input.md
├── Student_doc.md
├── source/
└── booklets/
```

All textual documents must follow Markdown syntax.  
Refer to [Markdown Guide](https://www.markdownguide.org/basic-syntax/) if needed.

### Textual Files Description

- **`input.md`** – describes the system overview, user stories, standard event schema, and rule model.  
  *Partial example available [here](https://drive.google.com/file/d/1klvQ8r8WkfW86HS8HQ801QZh-yXZ05sK/view?usp=sharing)*

- **`Student_doc.md`** – contains specifics of the deployed system.  
  *Structure available [here](https://drive.google.com/file/d/1stCQoen6ojT3hBexAkyp0Ja8H6Xz0uFn/view?usp=sharing)*  
  *Example available [here](https://drive.google.com/file/d/151mOqwYTG4qORk3bZgwM1RBwLaA5Gn-I/view?usp=sharing)*

The `booklets/` folder contains any additional documents (slides, images, etc.).

The `source/` folder contains the system source code, configuration files, Dockerfiles, docker-compose files, etc., following an **Infrastructure as Code (IaC)** approach, allowing instructors to rebuild/redeploy your system on any platform.

### Repository Naming

Each group needs to create a repo named:

```
<MATRICOLA>_<PROJECT>
```

where `<MATRICOLA>` is the INFOSTUD Student ID of the group leader and `<PROJECT>` is the acronym of your project/group.

### Important Notes

Before the discussion, you need to share with the instructor all documents and materials of your project, in particular the requirements (as user stories) of your entire system. User stories can be documented using a spreadsheet and collected in a booklet. For each user story, provide also:

- A LoFi mockup (prepared with tools like Balsamiq, Figma, etc.)  
- A textual description highlighting specific non-functional requirements (if any)

The system is developed using any technologies/frameworks you prefer. The release must be provided as a link to a GitHub repository with all source code, configuration files, Dockerfiles, docker-compose files, etc., following an IaC approach, so instructors can rebuild/redeploy your system on any platform (on-premise or cloud).
