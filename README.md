# JobLanded

Build a web app called JobMatch (or whatever name you prefer) that helps users manage their job search from resume to follow-up. Use Supabase for auth, database, and edge functions. Use the Claude API for resume parsing, job matching, and content generation.

Core Data Models

profiles

	•	id, user_id, full_name, email, phone, created_at

resumes

	•	id, user_id, raw_text, parsed_json (skills, titles, years_experience, education, keywords), file_url, created_at

jobs

	•	id, user_id, title, company, location, pay_min, pay_max, description, source_url, date_added

matches

	•	id, job_id, resume_id, similarity_score, match_explanation, created_at

tailored_documents

	•	id, job_id, resume_id, type (resume or cover_letter), content, created_at

applications

	•	id, user_id, job_id, status (saved, applied, interviewing, rejected, offer), date_applied, follow_up_date, notes, created_at

Features to Build

1. Auth & Onboarding

Standard email/password or magic link auth via Supabase. On first login, prompt the user to upload a resume.

2. Resume Upload & Parsing

Let the user upload a PDF or paste resume text. Send the text to an edge function that calls the Claude API to extract structured data: skills, job titles held, years of experience, education, and key achievements. Store both the raw text and the parsed JSON. Show the parsed profile back to the user so they can review and edit it.

3. Job Input

Let the user paste a job posting URL or paste the raw job description text directly into a form. Store it in the jobs table. (Skip live job board API integration for now, we’ll add that later once partner access is set up.)

4. Matching Engine

When a job is added, generate embeddings for both the resume’s parsed profile and the job description (use Claude API or an embeddings API), compute a cosine similarity score, and store it as a percentage. Also generate a short 2-3 sentence explanation of why the resume matches or doesn’t match, using the Claude API. Display this score and explanation on each job card.

5. Filtering & Sorting

On the jobs list page, let users filter by location, pay range, and minimum match percentage. Let them sort by match score or date added.

6. Resume & Cover Letter Tailoring

Add a “Tailor for this job” button on each job. This should call an edge function that sends the resume’s parsed data and the job description to the Claude API, and generates:

	•	A tailored resume using a single clean, standard template (reordered/reworded bullet points to emphasize relevant experience, same factual content)

	•	A cover letter tailored to the specific job and company

Store both as tailored_documents linked to that job and resume. Let the user view, edit, and download them as PDF or copy the text.

7. Application Tracker

A dashboard/table view showing all jobs the user has interacted with, their status (saved, applied, interviewing, rejected, offer), date applied, and notes. Let users update status with a dropdown and add free-text notes.

8. Follow-Up Reminders

When a user marks a job as “applied,” prompt them to set a follow-up date, defaulting to 7 days out if they don’t pick one. Build a “Follow-ups due” section on the dashboard showing jobs with a follow_up_date of today or earlier. Send an email reminder via a scheduled Supabase edge function on the follow-up date.

Design Notes

	•	Clean, simple layout: sidebar or top nav with Dashboard, Jobs, Resume, Applications

	•	Job cards should prominently show the match percentage (use a colored badge or ring, e.g. green for 80%+, yellow for 50-79%, red below 50%)

	•	Keep the tailoring output in an editable text area so users can tweak before downloading

Start by building auth, resume upload/parsing, and the parsed profile review screen first, since everything else depends on that data.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://joblanded.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5b2c5b78-7c18-48d9-b5a9-6331aef211a3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
