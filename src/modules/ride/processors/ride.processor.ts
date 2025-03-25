import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { RideService } from '../ride.service';
import { RideGateway } from '../ride.gateway';

@Processor('ride-request')
@Injectable()
export class RideRequestProcessor extends WorkerHost {
  constructor(
    private readonly rideService: RideService,
    private readonly rideGateway: RideGateway,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const payload = job.data;
    console.log(payload);
    const server = this.rideGateway.server;

    await this.rideService.handleRequestRide(null, server, payload);
  }
}
