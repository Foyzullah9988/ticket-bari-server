Project Overview
This is the server-side repository for the TicketBari Online Ticket Booking Platform, built as part of the selection process project.
TicketBari is a complete online platform for discovering and booking travel tickets (Bus, Train, Launch, Plane, etc.). It supports three user roles:

User: Browse, book, and pay for tickets.
Vendor: Add, update, and manage their tickets; handle booking requests.
Admin: Approve/reject tickets, manage users, and advertise tickets.

The backend is built using Node.js, Express.js, and MongoDB (part of the MERN stack).
Key Features (Backend)

User authentication (Email/Password + Google via Firebase or JWT-based).
Role-based access control (User, Vendor, Admin).
CRUD operations for tickets with verification workflow (pending → approved/rejected).
Booking management (pending → accepted/rejected → paid).
Stripe payment integration for completing bookings.
Advertisement management (max 6 advertised tickets).
API protection using JWT.
Image upload handling (via imgbb or similar).
Search, filter, sort, and pagination support for tickets.
Revenue/overview data aggregation for vendors.

Technologies Used

Node.js - Runtime environment.
Express.js - Web framework.
MongoDB - NoSQL database (with Mongoose ODM).
JWT - For API authentication and authorization.
cors - Cross-origin resource sharing.
dotenv - Environment variable management.
stripe - Payment processing.
axios or node-fetch - For external APIs .