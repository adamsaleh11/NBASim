import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SimulationService } from './simulation/services/simulation.service'; // Import SimulationService
import { Logger } from '@nestjs/common'; // Import Logger

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap'); // Create a logger for startup messages

  await app.listen(3000);
  logger.log(`Application is running on: ${await app.getUrl()}`);

  // Get the SimulationService instance
  const simulationService = app.get(SimulationService);

  // Run the simulation on startup (asynchronously)
  logger.log('Starting simulation on application startup...');
  try {
    const simulationResult = await simulationService.runSimulationForCurrentYear(); // Assuming you have this method in SimulationService (see step 2)
    logger.log('Simulation completed successfully!');
    // You can log or process the simulationResult here if needed
    // logger.debug('Simulation Result:', simulationResult); // Uncomment to log detailed result (might be verbose)

  } catch (error) {
    logger.error('Error running simulation on startup:', error);
  }
}
bootstrap();