import swaggerAutogen from 'swagger-autogen';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const doc = {
  info: {
    title: 'uve got mail BE API',
    description: 'API documentation for uve got mail BE',
    version: '1.0.0',
  },
};

const outputFile = path.resolve(__dirname, '../../dist/swagger-output.json');
const endpointsFiles = ['./src/server.ts'];

swaggerAutogen()(outputFile, endpointsFiles, doc);