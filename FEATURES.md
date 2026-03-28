# Student Schedule Management System - Feature Documentation

## 1. System Overview

The Student Schedule Management System is a web-based comprehensive schedule management platform that integrates course management, to-do items, and AI intelligent planning features to help students efficiently manage their daily study and life arrangements.

### Tech Stack
- **Frontend**: HTML5 + CSS3 + JavaScript (Vanilla)
- **Backend**: Supabase (PostgreSQL + Auth Service)
- **AI Service**: DeepSeek API
- **Deployment**: EdgeOne Pages

---

## 2. Core Feature Modules

### 2.1 User Authentication System

#### Features
- **Login/Register**: Support email and password registration and login
- **Session Management**: Automatically detect login status and maintain user sessions
- **Secure Logout**: One-click logout

#### Technical Implementation
- Uses Supabase Auth service
- Supports email verification
- Automatically listens for login state changes

---

### 2.2 Weekly Schedule View

#### Features
- **Week View Display**: Shows weekly course schedule in table format
- **Date Navigation**: Support switching to previous/next week
- **Time Scale**: Left side displays time slots for quick positioning

#### Display Types
| Type | Color | Description |
|------|-------|-------------|
| Fixed Course | Purple | Regular course schedule |
| Temporary Modification | Orange | Temporarily adjusted courses |
| To-do Item | Green | Personal to-do items |
| Conflict | Red | Items with time conflicts |

#### Interactive Features
- **Click to View Details**: Click any schedule item to view detailed information
- **Conflict Alert**: Automatically detect and highlight time conflicts
- **Multi-slot Display**: Support courses spanning multiple periods

---

### 2.3 Fixed Course Management

#### Features
- **Add Course**: Create new fixed courses
- **Edit Course**: Modify existing course information
- **Delete Course**: Remove unwanted courses

#### Course Attributes
| Attribute | Description | Required |
|-----------|-------------|----------|
| Course Name | Name of the course | Yes |
| Day | Monday to Sunday | Yes |
| Start Period | Starting period of the course | Yes |
| End Period | Ending period of the course | Yes |
| Location | Classroom location | No |
| Effective Weeks | Week range when the course is effective | No |

#### Week Settings
- Support range format: `1-16`
- Support discrete format: `1,3,5,7,9`
- Leave empty for full semester

---

### 2.4 To-do Item Management

#### Features
- **Add To-do**: Create personal to-do items
- **Edit To-do**: Modify to-do information
- **Delete To-do**: Remove completed to-dos
- **Alarm Reminder**: Set reminder alarms

#### To-do Attributes
| Attribute | Description | Required |
|-----------|-------------|----------|
| To-do Name | Item name | Yes |
| Date | Specific date | Yes |
| Start Time | Start time | No |
| End Time | End time | No |
| Location | Item location | No |
| Note | Additional notes | No |
| Alarm | Whether to set reminder | No |

---

### 2.5 Temporary Course Modification

#### Features
- **Temporary Adjustment**: One-time adjustment to fixed courses
- **Time Modification**: Temporarily change class time
- **Location Modification**: Temporarily change classroom
- **Cancel Modification**: Restore original course schedule

#### Use Cases
- Teacher's temporary schedule change
- Temporary classroom change
- Course adjustment under special circumstances

---

### 2.6 AI Intelligent Planning

#### Features
AI intelligent planning provides intelligent schedule management assistance through DeepSeek API, supporting three conversation modes:

#### 2.6.1 Single To-do Mode
- **Purpose**: Quickly add one-time to-do items
- **Intelligent Parsing**: Automatically extract time, location, etc. from natural language
- **Conflict Detection**: Automatically detect conflicts with existing arrangements
- **Guided Completion**: Guide users to complete missing information

**Example Dialog**:
```
User: Study at the library tomorrow from 3pm to 5pm
AI: Created to-do item for you: Study at the library tomorrow (2024-01-15) from 3pm to 5pm. Please confirm to add.
```

#### 2.6.2 Course Setting Mode
- **Purpose**: Set or modify course arrangements
- **Fixed Course Setting**: Add new fixed courses
- **Temporary Modification**: Temporarily adjust existing courses
- **Multi-day Courses**: Support one course with different times and locations on different days

**Example Dialog**:
```
User: Help me add Advanced Math class, Monday and Wednesday morning periods 1-2, Monday in A101, Wednesday in A102
AI: Created course "Advanced Math" for you:
    - Monday Period 1-2 A101
    - Wednesday Period 1-2 A102
    Please confirm to add.
```

#### 2.6.3 Long-term Planning Mode
- **Purpose**: Create periodic long-term plans
- **Auto Scheduling**: Automatically arrange time based on user needs
- **Batch Creation**: Create multiple related to-do items at once

**Example Dialog**:
```
User: I want to go to the gym every Monday, Wednesday, Friday evening
AI: Planned "Gym Workout" for you:
    - Time: Every Mon/Wed/Fri 19:00-21:00
    - Duration: Remaining weeks of this semester
    Please confirm to add.
```

#### AI Features
- **Natural Language Understanding**: Support Chinese natural language input
- **Intelligent Time Parsing**: Automatically parse expressions like "tomorrow", "next Wednesday", "3pm"
- **Conflict Detection**: Automatically detect time conflicts and alert
- **Preview Confirmation**: All suggestions are previewed first, taking effect after user confirmation

---

### 2.7 Time Settings

#### Features
- **Semester Settings**: Set semester start date and total weeks
- **Period Settings**: Customize time slots for each period
- **Flexible Adjustment**: Support adding/removing periods

#### Settings
| Setting | Description |
|---------|-------------|
| Semester Start Date | Monday date of the first week |
| Total Semester Weeks | Default 20 weeks |
| Daily Periods | Support 1-15 periods |
| Period Time | Customize start and end time for each period |

---

## 3. Data Storage

### Database Structure

#### Users Table
- Managed automatically through Supabase Auth

#### Courses Table
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | User ID |
| name | text | Course name |
| day | integer | Day of week (1-7) |
| time_start | integer | Start period |
| time_end | integer | End period |
| location | text | Location |
| weeks | text | Effective weeks |

#### Todos Table
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | User ID |
| name | text | To-do name |
| date | date | Date |
| start_time | text | Start time |
| end_time | text | End time |
| location | text | Location |
| note | text | Note |
| alarm | boolean | Whether alarm is set |

#### Course Modifications Table
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | User ID |
| course_id | uuid | Original course ID |
| week | integer | Modified week |
| new_day | integer | New day of week |
| new_time_start | integer | New start period |
| new_time_end | integer | New end period |
| new_location | text | New location |

---

## 4. Security Features

### Authentication Security
- Minimum password length: 6 characters
- Uses Supabase secure authentication
- Automatic session management

### Data Security
- Row Level Security (RLS) policies
- User data isolation
- Server-side API key storage

### Deployment Security
- Environment variables for sensitive information
- config.js not committed to repository
- HTTPS encrypted transmission

---

## 5. Deployment Instructions

### Environment Variable Configuration
Configure the following environment variables in EdgeOne Pages console:

| Variable Name | Description |
|---------------|-------------|
| SUPABASE_URL | Supabase project URL |
| SUPABASE_ANON_KEY | Supabase anonymous key |
| DEEPSEEK_API_KEY | DeepSeek API key |

### Build Process
1. EdgeOne pulls code from GitHub
2. Execute `npm run build`
3. build.js generates config.js from environment variables
4. Deployment complete

---

## 6. Usage Flow

### First Time Use
1. Register account (email + password)
2. Set semester start date
3. Add fixed courses
4. Start using schedule management

### Daily Use
1. View this week's schedule
2. Add to-do items
3. Use AI intelligent planning
4. Temporarily adjust courses

### AI Assistance
1. Select conversation mode
2. Describe needs in natural language
3. Confirm AI suggestions
4. Automatically add to schedule

---

## 7. FAQ

### Q: What if there's a course time conflict?
A: The system automatically detects conflicts and highlights them in red. Click to view details.

### Q: How to modify an added course?
A: Find the course on the "Fixed Courses" page and click the edit button to modify.

### Q: What if AI planning suggestions are inaccurate?
A: You can continue the conversation with AI to provide more detailed information, or add manually.

### Q: Will data be lost?
A: All data is stored in Supabase cloud database, safe and reliable.

---

## 8. Changelog

### v1.0.0
- Basic schedule management features
- User authentication system
- AI intelligent planning feature
- EdgeOne deployment support
