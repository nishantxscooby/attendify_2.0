# Attendify 2.0  
Smart Attendance System using Face Recognition, Geofencing, and Real-Time Analytics

Attendify 2.0 is a full-stack attendance automation platform combining AI-powered face recognition, geolocation validation, and multi-role dashboards.  
It provides fast, reliable attendance for students, teachers, administrators, and policymakers.

---

## 🚀 Features

### Core System
- Face Recognition Attendance (FaceNet)
- Geofencing-based verification
- Multi-role authentication (Student, Teacher, Admin)
- Real-time session tracking
- Class schedule integration
- Attendance analytics & insights

### Web Frontend (Next.js)
- Clean dashboard UI using Tailwind + ShadCN
- Student panel: overview, attendance history, schedule
- Teacher panel: attendance sessions, reports
- Admin panel:
  - student management  
  - teacher management  
  - user roles  
  - geofencing tools  
  - analytics overview  

### Python Backend (FastAPI)
- REST API for attendance, users, sessions
- FaceNet service for facial embeddings
- Firestore & SQLite integrations
- Background sync tasks

### Mobile App (Flutter)
- Face-recognition attendance
- GPS validation
- Push notifications
- Works on Android, iOS & Web

---

## 🧱 Architecture

```
Frontend (Next.js) ────────┐
                            ├── REST API (FastAPI)
Flutter App ───────────────┘
                                │
                                ├── FaceNet Microservice
                                │
                                └── Firebase (Auth / Firestore / Storage)
```

---

## 🛠 Tech Stack

### Frontend
- Next.js 14  
- TypeScript  
- Tailwind CSS  
- ShadCN UI  

### Backend
- Python  
- FastAPI  
- SQLite / Firestore  
- FaceNet  

### Mobile
- Flutter  
- Firebase Auth  
- Cloud Functions  

---

## 📁 Project Structure

```
attendify_2.0/
│
├── attendify_frontend/   # Next.js dashboard
├── attendify_backend/    # FastAPI + FaceNet backend
└── attendance_app/       # Flutter mobile app
```

---

## 🔧 Setup Instructions

### Clone the repository
```sh
git clone https://github.com/nishantxscooby/attendify_2.0.git
cd attendify_2.0
```

### Install frontend dependencies
```sh
cd attendify_frontend
npm install
npm run dev
```

### Run backend (FastAPI)
```sh
cd attendify_backend
pip install -r requirements.api.txt
uvicorn app:app --reload
```

### Run FaceNet microservice
```sh
cd facenet_service
pip install -r requirements.facenet.txt
python facenet_service.py
```

### Run the Flutter App
```sh
cd attendance_app
flutter pub get
flutter run
```

---

## 🤝 Contributing

Contributions are welcome!

Please read:
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`

Open a pull request anytime.

---

## 🗺 Roadmap

- [ ] Add liveness detection  
- [ ] Admin analytics V2  
- [ ] Classroom geofencing  
- [ ] Offline mobile attendance  
- [ ] Teacher mobile dashboards  

---

## 📄 License

This project is open source and available under the MIT License - see `LICENSE`

---

## 🔎 SEO (IGNORE)

Repo description: "Attendify 2.0 — Open-source face recognition + geofencing attendance system"

Topics: attendance, face-recognition, geofencing, nextjs, fastapi, flutter, open-source

## ❤️ Maintainer

Nishant 
B.Tech CSE — Developer & Maintainer

