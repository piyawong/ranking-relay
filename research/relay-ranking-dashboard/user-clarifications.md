# User Clarifications and Assumptions

## Assumptions Made (Based on INITIAL.md)

### Data Ingestion
- **Assumption**: The array index in `relay_details` represents arrival order (0 = first to arrive)
- **Assumption**: Lower ranking scores are better (similar to race positions)
- **Assumption**: All relays in a block should be processed together

### Ranking Algorithm
- **Assumption**: Ranking score formula combines:
  - Arrival order (primary weight: 50%)
  - Latency (secondary weight: 30%)
  - Packet loss (tertiary weight: 20%)
- **Formula**: `score = (arrival_order * 50) + (latency * 0.3) + (loss * 0.2)`

### Real-time Updates
- **Assumption**: Polling interval of 5 seconds is acceptable for "real-time" updates
- **Assumption**: WebSocket support not required initially

### Data Retention
- **Assumption**: Keep all historical data indefinitely
- **Assumption**: No automatic data purging required initially

### Performance Requirements
- **Assumption**: Dashboard should handle up to 100 relays per block
- **Assumption**: Display last 1000 blocks in history
- **Assumption**: Response time < 2 seconds for queries

### Authentication
- **Assumption**: No authentication required initially (public dashboard)
- **Assumption**: API endpoints are open for data submission

### Data Validation
- **Assumption**: Latency is in milliseconds
- **Assumption**: Loss is a percentage (0-100)
- **Assumption**: Relay names are unique identifiers

### UI/UX Decisions
- **Assumption**: Desktop-first design with mobile responsiveness
- **Assumption**: Dark mode not required initially
- **Assumption**: Export to CSV format for reports

### Deployment
- **Assumption**: Single server deployment is sufficient initially
- **Assumption**: No need for CDN or edge deployment
- **Assumption**: PostgreSQL and app can run on same Docker network

## Questions for Future Clarification

### Business Logic
1. Should we calculate rankings differently for different block types?
2. Are there any relay names that should be prioritized/deprioritized?
3. Should we track relay uptime/availability?

### Data Management
1. What's the expected data volume per day?
2. Should we implement data archival after X days?
3. Do we need audit logs for data changes?

### Features
1. Should we add email alerts for poor relay performance?
2. Do we need API rate limiting per client?
3. Should we support bulk data import?

### Integration
1. Will other systems need to query our data?
2. Should we provide webhook notifications for events?
3. Do we need to integrate with monitoring systems?

## Design Decisions Made

### API Design
- RESTful API (not GraphQL) for simplicity
- JSON payloads (not Protocol Buffers)
- Synchronous processing (not message queue based)

### Frontend
- Server-side rendering for initial load
- Client-side updates for real-time data
- No PWA features initially

### Database
- Single PostgreSQL instance (no read replicas)
- No caching layer (Redis) initially
- Synchronous replication within docker-compose

### DevOps
- Manual deployment process initially
- No auto-scaling configuration
- Basic health checks only

## Future Enhancements Noted

1. **Authentication System**: Add secure access control
2. **WebSocket Support**: True real-time updates
3. **Advanced Analytics**: ML-based performance predictions
4. **Multi-region Support**: Deploy closer to users
5. **Data Pipeline**: Stream processing for high volume
6. **Mobile App**: Native mobile applications
7. **API Versioning**: Support multiple API versions
8. **Internationalization**: Multi-language support
9. **Advanced Filtering**: Complex query capabilities
10. **Alerting System**: Proactive performance monitoring