import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SimulationService } from './services/simulation.service';
import { SimulationResolver } from './resolvers/simulation.resolver'; // Import SimulationResolver
import { SimulationSchema } from './schemas/simulation.schema';
import { DataSourceModule } from "../data-source/data-source.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Simulation', schema: SimulationSchema }]),
    DataSourceModule,
  ],
  providers: [SimulationService, SimulationResolver], // Add SimulationResolver to providers
  exports: [SimulationService],
})
export class SimulationModule {}