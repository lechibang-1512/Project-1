# Master Specs DB Component Viewer

A Node.js web application for viewing and searching computer component specifications stored in a MariaDB database.

## Features

- Browse components by category (CPU, Motherboard, RAM, SSD, PSU, Case)
- View detailed component specifications
- Search components by various attributes
- Responsive design for desktop and mobile

## Technologies Used

- Node.js
- Express.js
- EJS (Embedded JavaScript templates)
- MariaDB
- Bootstrap 5

## Prerequisites

- Node.js (v14 or newer)
- MariaDB server
- master_specs_db database with component tables

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables (in .env file):
   ```
   DB_HOST=localhost
   DB_USER=lechibang
   DB_PASS=1212
   DB_NAME=master_specs_db
   PORT=3000
   ```

## Usage

1. Start the application:
   ```
   npm start
   ```
   
   For development with auto-restart:
   ```
   npm run dev
   ```

2. Open your browser and navigate to: `http://localhost:3000`

## Database Structure

The application works with the following tables:
- cpu_specs
- motherboard_specs
- ram_specs
- ssd_specs
- psu_specs
- case_specs

## License

ISC
