import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('RagController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    // Wait for RagService to finish onModuleInit (ChromaDB, embeddings, etc)
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds delay
  });

  afterAll(async () => {
    await app.close();
  });

  const basePatient = {
    age: 34,
    gender: 'Male',
    sexAtBirth: 'Male',
    weightKg: 93,
    heightCm: 177,
    ethnicity: 'White',
    isSmoker: false,
    alcoholConsumption: 'Never',
    exercise: '5-10 hours a week',
    dietType: 'Moderately healthy',
    isTransitioning: false,
    supplements: ['Zinc', 'Vitamin D', 'Creatine', 'Magnesium'],
    goal: 'increase fitness',
    sportOrExercise: 'gym',
    sportFrequency: '6.10',
    trainingInformation: "I'm doing a upper/lower split workout of 4 days. Each session takes me around 1h and 30min and then 20min of cardio. I try to do 10k steps daily",
    additionalInformation: 'My diet prioritises protein',
    conditions: ['']
  };

  const healthyResults = [
    { name: 'active-b12', value: '105 pmol/L', status: 'Healthy' },
    { name: 'albumin', value: '48 g/L', status: 'Healthy' },
    { name: 'creatinine', value: '90 umol/L', status: 'Healthy' },
  ];

  const outOfRangeResults = [
    { name: 'creatinine', value: '136 umol/L', status: 'High' },
    { name: 'egfr', value: '59 mL/min/1.73m*2', status: 'Low' },
    { name: 'albumin', value: '48 g/L', status: 'Healthy' },
  ];

  const prevData = {
    results: [
      { name: 'creatinine', value: '108 umol/L', status: 'Healthy' },
      { name: 'egfr', value: '78 mL/min/1.73m²', status: 'Healthy' },
      { name: 'albumin', value: '51 g/L', status: 'Moderately High' },
    ],
    profile: {
      weightKg: 90,
      isSmoker: false,
      alcoholConsumption: 'Never',
      exercise: '',
      dietType: 'Moderately healthy',
      isTransitioning: false,
      supplements: ['Vitamin D', 'Magnesium'],
      goal: 'increase fitness',
      sportOrExercise: '',
      sportFrequency: '',
      trainingInformation: '',
      additionalInformation: 'My diet prioritises protein',
      conditions: ['']
    }
  };

  it('should return a successful comment with only current results (no prevData)', async () => {
    const res = await request(app.getHttpServer())
      .post('/rag/generate-comment')
      .send({ patient: basePatient, results: healthyResults })
      .expect(201);
    expect(res.body.comment).toContain('Excellent news');
    expect(res.body.comment).toContain('healthy range');
  });

  it('should return a successful comment with prevData and highlight changes', async () => {
    const res = await request(app.getHttpServer())
      .post('/rag/generate-comment')
      .send({ patient: basePatient, results: outOfRangeResults, prevData })
      .expect(201);
    expect(res.body.comment).toContain('Your creatinine was');
    expect(res.body.comment).toContain('Your albumin has improved');
    expect(res.body.comment).toContain('egfr');
  }, 20000); // 20 seconds timeout

  it('should handle missing required fields (patient)', async () => {
    const res = await request(app.getHttpServer())
      .post('/rag/generate-comment')
      .send({ results: healthyResults })
      .expect(400);
    expect(res.body.message).toBeDefined();
  });

  it('should handle missing required fields (results)', async () => {
    const res = await request(app.getHttpServer())
      .post('/rag/generate-comment')
      .send({ patient: basePatient })
      .expect(400);
    expect(res.body.message).toBeDefined();
  });

  it('should handle invalid biomarker status', async () => {
    const invalidResults = [
      { name: 'creatinine', value: '136 umol/L', status: 'INVALID' }
    ];
    const res = await request(app.getHttpServer())
      .post('/rag/generate-comment')
      .send({ patient: basePatient, results: invalidResults })
      .expect(400);
    expect(res.body.message).toBeDefined();
  }, 20000); // 20 seconds timeout

  // it('should return a comment mentioning only explainable biomarkers', async () => {
  //   const resultsWithUnexplained = [
  //     { name: 'progesterone', value: '0.6 nmol/L', status: 'High' },
  //     { name: 'albumin', value: '48 g/L', status: 'Healthy' }
  //   ];
  //   const res = await request(app.getHttpServer())
  //     .post('/rag/generate-comment')
  //     .send({ patient: basePatient, results: resultsWithUnexplained })
  //     .expect(201);
  //   expect(res.body.comment).not.toContain('progesterone');
  //   expect(res.body.comment).toContain('albumin');
  // });

  it('should return a comment with profile changes if present in prevData', async () => {
    const changedProfile = { ...basePatient, weightKg: 95 };
    const res = await request(app.getHttpServer())
      .post('/rag/generate-comment')
      .send({ patient: changedProfile, results: outOfRangeResults, prevData })
      .expect(201);
    expect(res.body.comment).toContain('Your weight has increased');
  }, 20000); // 20 seconds timeout
});
