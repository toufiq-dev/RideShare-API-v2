import { Injectable, OnModuleInit } from '@nestjs/common';
import * as promClient from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: promClient.Registry;
  public readonly httpRequestDuration: promClient.Histogram<string>;
  public readonly httpRequestTotal: promClient.Counter<string>;
  public readonly httpRequestErrors: promClient.Counter<string>;
  public readonly activeConnections: promClient.Gauge<string>;
  public readonly databaseQueryDuration: promClient.Histogram<string>;
  public readonly redisOperationDuration: promClient.Histogram<string>;
  public readonly rideBookings: promClient.Counter<string>;
  public readonly rideCompletions: promClient.Counter<string>;
  public readonly rideCancellations: promClient.Counter<string>;
  public readonly pilotOnlineStatus: promClient.Gauge<string>;
  public readonly driverSearchDuration: promClient.Histogram<string>;
  public readonly paymentTransactions: promClient.Counter<string>;
  public readonly businessMetrics: promClient.Gauge<string>;

  constructor() {
    // Create a new registry
    this.registry = new promClient.Registry();

    // Default metrics (CPU, memory, etc.)
    promClient.collectDefaultMetrics({
      register: this.registry,
      prefix: 'fairdrive_',
    });

    // HTTP Metrics
    this.httpRequestDuration = new promClient.Histogram({
      name: 'fairdrive_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'version'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [this.registry],
    });

    this.httpRequestTotal = new promClient.Counter({
      name: 'fairdrive_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'version'],
      registers: [this.registry],
    });

    this.httpRequestErrors = new promClient.Counter({
      name: 'fairdrive_http_errors_total',
      help: 'Total number of HTTP errors',
      labelNames: ['method', 'route', 'status_code', 'version', 'error_type'],
      registers: [this.registry],
    });

    // Application Metrics
    this.activeConnections = new promClient.Gauge({
      name: 'fairdrive_active_connections',
      help: 'Number of active connections',
      labelNames: ['type'],
      registers: [this.registry],
    });

    // Database Metrics
    this.databaseQueryDuration = new promClient.Histogram({
      name: 'fairdrive_database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    // Redis Metrics
    this.redisOperationDuration = new promClient.Histogram({
      name: 'fairdrive_redis_operation_duration_seconds',
      help: 'Duration of Redis operations in seconds',
      labelNames: ['operation', 'status'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
      registers: [this.registry],
    });

    // Business Metrics
    this.rideBookings = new promClient.Counter({
      name: 'fairdrive_ride_bookings_total',
      help: 'Total number of ride bookings',
      labelNames: ['vehicle_type', 'city', 'version'],
      registers: [this.registry],
    });

    this.rideCompletions = new promClient.Counter({
      name: 'fairdrive_ride_completions_total',
      help: 'Total number of completed rides',
      labelNames: ['vehicle_type', 'city', 'version'],
      registers: [this.registry],
    });

    this.rideCancellations = new promClient.Counter({
      name: 'fairdrive_ride_cancellations_total',
      help: 'Total number of cancelled rides',
      labelNames: ['vehicle_type', 'cancelled_by', 'version'],
      registers: [this.registry],
    });

    this.pilotOnlineStatus = new promClient.Gauge({
      name: 'fairdrive_pilot_online_status',
      help: 'Number of pilots online',
      labelNames: ['vehicle_type', 'city'],
      registers: [this.registry],
    });

    this.driverSearchDuration = new promClient.Histogram({
      name: 'fairdrive_driver_search_duration_seconds',
      help: 'Duration of driver search operations in seconds',
      labelNames: ['status', 'iterations'],
      buckets: [1, 5, 10, 30, 60, 120],
      registers: [this.registry],
    });

    this.paymentTransactions = new promClient.Counter({
      name: 'fairdrive_payment_transactions_total',
      help: 'Total number of payment transactions',
      labelNames: ['type', 'status', 'version'],
      registers: [this.registry],
    });

    this.businessMetrics = new promClient.Gauge({
      name: 'fairdrive_business_metrics',
      help: 'Business metrics',
      labelNames: ['metric_name', 'city'],
      registers: [this.registry],
    });
  }

  onModuleInit() {
    // Initialize metrics
    this.activeConnections.set({ type: 'http' }, 0);
    this.activeConnections.set({ type: 'websocket' }, 0);
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getRegistry(): promClient.Registry {
    return this.registry;
  }

  // Helper methods
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
  ) {
    const version = process.env.API_VERSION || 'v1';
    const routeLabel = this.sanitizeRoute(route);

    this.httpRequestDuration.observe(
      {
        method,
        route: routeLabel,
        status_code: statusCode.toString(),
        version,
      },
      duration / 1000,
    );

    this.httpRequestTotal.inc({
      method,
      route: routeLabel,
      status_code: statusCode.toString(),
      version,
    });

    if (statusCode >= 400) {
      this.httpRequestErrors.inc({
        method,
        route: routeLabel,
        status_code: statusCode.toString(),
        version,
        error_type: statusCode >= 500 ? 'server_error' : 'client_error',
      });
    }
  }

  recordDatabaseQuery(
    operation: string,
    table: string,
    duration: number,
    success: boolean,
  ) {
    this.databaseQueryDuration.observe(
      { operation, table, status: success ? 'success' : 'error' },
      duration / 1000,
    );
  }

  recordRedisOperation(operation: string, duration: number, success: boolean) {
    this.redisOperationDuration.observe(
      { operation, status: success ? 'success' : 'error' },
      duration / 1000,
    );
  }

  private sanitizeRoute(route: string): string {
    // Replace UUIDs and IDs with placeholders for better aggregation
    return route
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id',
      )
      .replace(/\/\d+/g, '/:id')
      .replace(/\?.*$/, '');
  }
}
