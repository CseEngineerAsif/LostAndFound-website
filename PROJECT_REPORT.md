# Lost2Found

**Project Report**

**Abstract**  
Lost2Found is a web application that helps students and staff report, search, and recover lost items efficiently. The system provides user authentication, item reporting with optional photo uploads, and searchable listings by category, location, and status. It reduces manual coordination, improves item visibility, and shortens recovery time through a centralized, easy-to-use portal.

**Objectives**  
- Provide a simple platform to report lost and found items.  
- Enable fast searching and filtering by item details and location.  
- Support photo uploads to improve identification accuracy.  
- Offer basic status tracking for items over time.  
- Keep the system lightweight and easy to deploy for campus use.

**Introduction**  
Lost items are common in university environments, and traditional notice boards or social media posts are fragmented and hard to track. This project introduces a centralized web portal where users can create reports for lost or found items and quickly search listings to match items to their owners. The focus is on usability, speed, and a clean workflow that works well on both desktop and mobile devices.

**Technology Stack**  
- Frontend: HTML, CSS, EJS templates  
- Backend: Node.js with Express  
- Database: `lowdb` (JSON-based local datastore)  
- File Uploads: Multer (for item photos)  
- Tooling: npm scripts for setup and run

**Features**  
- User registration and login  
- Create lost or found item reports  
- Optional photo upload for each item  
- Search and filter by name, category, location, and type  
- Simple dashboard and status tracking  
- Clean, responsive UI

**Benefits**  
- Centralized system reduces manual coordination  
- Faster matching of lost and found items  
- Photos improve accuracy and reduce false matches  
- Simple deployment for campus IT teams  
- Scalable foundation for future enhancements

**Work Flow**  
1. User registers and logs in.  
2. User submits a lost or found report with item details and optional photo.  
3. Reports are stored in the database and displayed in listings.  
4. Users search and filter listings to find matching items.  
5. Status is updated when items are recovered or resolved.

**Conclusion**  
Lost2Found provides a practical, lightweight solution to a common campus problem. By centralizing reporting and search, it improves visibility of lost items and accelerates recovery. The current prototype demonstrates core functionality and can be extended with notifications, moderation, and a production-grade database for wider adoption.
