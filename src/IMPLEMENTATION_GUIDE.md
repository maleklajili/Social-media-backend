# Job Applications with CV Upload - Backend Implementation

## Overview

Complete implementation for job applications functionality with CV file upload support in the backend.

## Features

### 1. **Job Application Model** (`job-application.ts`)

- Track job applications with candidate information
- Support CV file upload with validation
- Application status tracking (pending, viewed, accepted, rejected, withdrawn)
- Ratings and scoring system
- Recruiter response messages

### 2. **CV Upload Middleware** (`cv-upload-middleware.ts`)

- Multipart/form-data file handling
- File type validation (PDF, DOC, DOCX)
- File size validation (max 5MB)
- Automatic file naming with timestamp
- Upload directory management

### 3. **Application Repository** (`job-application-repository.ts`)

Database operations for applications:

- Add/Update/Delete applications
- Query by job, user, or company
- Check duplicate applications
- Count applications

### 4. **Application Service** (`job-application-services.ts`)

Business logic:

- Apply for jobs with CV upload
- Update application status
- Withdraw applications
- Add recruiter responses
- Rate applications
- Coins system integration

### 5. **Application Controller** (`job-application-controller.ts`)

API endpoints:

- `POST /job-applications/apply/:jobId` - Apply for a job
- `GET /job-applications/my-applications` - Get user's applications
- `GET /job-applications/job/:jobId` - Get applications for a job
- `GET /job-applications/company-applications` - Get company's applications
- `PUT /job-applications/:id/status` - Update application status
- `PUT /job-applications/:id/withdraw` - Withdraw application
- `PUT /job-applications/:id/respond` - Add recruiter response
- `PUT /job-applications/:id/rate` - Rate application

## API Examples

### 1. Apply for a Job with CV Upload

```bash
curl -X POST "http://localhost:3000/job-applications/apply/JOBID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "cv=@/path/to/your/resume.pdf" \
  -F "coverLetter=I am interested in this position because..."
```

**Response (201 Created):**

```json
{
  "_id": "6476abc123def456789ghi",
  "jobId": "6476abc123def456789jkl",
  "userId": "6476abc123def456789mno",
  "companyId": "6476abc123def456789pqr",
  "applicantName": "John Doe",
  "applicantEmail": "john@example.com",
  "applicantPhone": "+1234567890",
  "cvFileName": "cv-1234567890.pdf",
  "cvPath": "./uploads/cv/cv-1234567890.pdf",
  "cvSize": 245632,
  "coverLetter": "I am interested in this position because...",
  "status": "pending",
  "appliedAt": "2024-03-05T10:30:00Z",
  "createdAt": "2024-03-05T10:30:00Z",
  "updatedAt": "2024-03-05T10:30:00Z"
}
```

### 2. Get My Applications

```bash
curl -X GET "http://localhost:3000/job-applications/my-applications" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Get Applications for a Job

```bash
curl -X GET "http://localhost:3000/job-applications/job/JOBID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Update Application Status

```bash
curl -X PUT "http://localhost:3000/job-applications/APPLICATIONID/status" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "viewed"}' \
  -G --data-urlencode "companyId=COMPANYID"
```

### 5. Withdraw Application

```bash
curl -X PUT "http://localhost:3000/job-applications/APPLICATIONID/withdraw" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Add Response to Application

```bash
curl -X PUT "http://localhost:3000/job-applications/APPLICATIONID/respond" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "response": "Thank you for your application. We are impressed with your qualifications."
  }' \
  -G --data-urlencode "companyId=COMPANYID"
```

### 7. Rate Application

```bash
curl -X PUT "http://localhost:3000/job-applications/APPLICATIONID/rate" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ratings": {
      "experience": 4,
      "skills": 5,
      "qualifications": 4
    }
  }' \
  -G --data-urlencode "companyId=COMPANYID"
```

## File Structure

```
src/
├── models/
│   └── job-application.ts          # Application model
├── repositories/
│   └── job-application-repository.ts
├── services/
│   └── job-application-services.ts
├── controllers/
│   └── job-application-controller.ts
├── interfaces/
│   └── job/
│       ├── i-job-application-repository.ts
│       └── i-job-application-service.ts
├── middleware/
│   └── cv-upload-middleware.ts     # CV upload handling
└── uploads/
    └── cv/                          # CV storage directory
```

## Database Schema

### JobApplication Collection

```typescript
{
  _id: ObjectId,
  jobId: ObjectId,              // Reference to job
  userId: ObjectId,             // Applicant's user ID
  companyId: ObjectId,          // Job's company
  applicantName: string,
  applicantEmail: string,
  applicantPhone: string,
  cvFileName: string,           // Original CV filename
  cvPath: string,               // Server path to CV
  cvSize: number,               // File size in bytes
  coverLetter: string,
  status: "pending" | "viewed" | "accepted" | "rejected" | "withdrawn",
  appliedAt: Date,
  viewedAt: Date,
  respondedAt: Date,
  response: string,             // Recruiter's message
  score: number,                // 0-100 matching score
  ratings: {
    experience: number,         // 0-5
    skills: number,             // 0-5
    qualifications: number      // 0-5
  },
  createdAt: Date,
  updatedAt: Date
}
```

## Coins System Integration

The application includes coins rewards:

```typescript
APPLY_JOB: 2 coins              // Awarded when applying
REVIEW_APPLICATION: 3 coins     // Awarded when recruiter reviews
```

## Error Handling

Common error responses:

```json
{
  "error": "You have already applied to this job"
}
```

```json
{
  "error": "Invalid file type. Only PDF, DOC, and DOCX files are allowed."
}
```

```json
{
  "error": "File size exceeds maximum limit of 5MB. Your file is 6.50MB."
}
```

## File Upload Specifications

- **Allowed formats**: PDF, DOC, DOCX
- **Maximum file size**: 5MB
- **Upload location**: `./uploads/cv/`
- **File naming**: `cv-{timestamp}.{extension}`

## Implementation Notes

1. **CV Download**: Add endpoint to download CV files from `/uploads/cv/` path
2. **Company ID Management**: Currently passing companyId as query parameter - should integrate with company ownership logic
3. **Notifications**: Consider adding email notifications when applications are received/reviewed
4. **Pagination**: Add pagination for large application lists
5. **Filtering**: Add filters for status, date range, etc.

## Security Considerations

- ✅ File type validation
- ✅ File size limits
- ✅ User authentication required
- ⚠️ Add rate limiting for application endpoint
- ⚠️ Scan uploaded files for malware
- ⚠️ Implement permission checks for file access

## Future Enhancements

1. **AI-Powered Matching**: Automatic scoring based on CV and job requirements
2. **Bulk Operations**: Process multiple applications at once
3. **Export Candidates**: Export application data to CSV/Excel
4. **Interview Scheduling**: Integration with calendar for scheduling
5. **Email Notifications**: Automatic email updates
6. **Application Analytics**: Dashboard for recruitment metrics
