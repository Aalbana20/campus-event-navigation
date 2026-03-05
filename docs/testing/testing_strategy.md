# Testing Strategy (Draft)

## Objectives
- Verify core functional requirements: events, RSVP, buildings
- Verify key non-functional needs: auth security basics and acceptable response time

## Tools
- Postman (API testing + evidence screenshots/logs)
- Later: Jest/Supertest (Node) or PyTest (Python) for automation

## Testing Levels (All explained; at least one executed)
1. Unit Testing (planned)
- RSVP capacity logic
- auth validation
2. Integration Testing (planned)
- API endpoints + database operations
3. System Testing (planned)
- End-to-end: organizer creates event -> student finds event -> student RSVPs
4. Acceptance Testing (will execute)
- PO acceptance using user stories + PASS/FAIL
5. Non-functional (explained)
- Performance: basic response time check
- Security: auth/authorization + input validation checks
- Usability: feedback from team testers

## Evidence to Save (Appendix)
- Postman screenshots / response logs
- Test case table with PASS/FAIL
- Traceability: requirement -> endpoint -> test case