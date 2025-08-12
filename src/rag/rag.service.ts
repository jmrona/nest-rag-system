import { Injectable, OnModuleInit, Logger, BadRequestException } from '@nestjs/common';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
    RunnableSequence
} from '@langchain/core/runnables';
import { formatDocumentsAsString } from 'langchain/util/document';
import {
  ChatPromptTemplate
} from '@langchain/core/prompts';
import { Chroma } from '@langchain/community/vectorstores/chroma'
import * as fs from 'fs/promises';
import * as path from 'path';
import { GenerateCommentDto } from './dto/generate-comment.dto';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

@Injectable()
export class RagService implements OnModuleInit {
    private readonly logger = new Logger(RagService.name);
    private llm: ChatOpenAI | ChatGoogleGenerativeAI;
    private embeddings: OpenAIEmbeddings;
    private vectorStore: Chroma;
    private lastPrompt: string | null = null;

    constructor(private configService: ConfigService) {
        const openAIApiKey = this.configService.get<string>('OPENAI_API_KEY');
        this.llm = new ChatOpenAI({ openAIApiKey });

        // const googleApiKey = this.configService.get<string>('GOOGLE_API_KEY');
        // this.llm = new ChatGoogleGenerativeAI({ 
        //     apiKey: googleApiKey,
        //     model: 'gemini-2.0-flash',
        //     temperature: 0.2
        // });

        this.embeddings = new OpenAIEmbeddings({
            model: "text-embedding-3-small",
            apiKey: openAIApiKey,
        });
    }

    async onModuleInit() {
        this.vectorStore = new Chroma(this.embeddings, {
            collectionName: 'medical-knowledge-base',
            url: 'http://localhost:8000',
        })

        await this.loadAndProcessDocuments()
    }

    private async loadAndProcessDocumentsHardCoded() {
        this.logger.log('Loading and processing documents...');

        const docs = [
            new Document({
                pageContent: "NestJS es un framework de Node.js para construir aplicaciones de backend eficientes y escalables.",
                metadata: { source: 'doc1' },
            }),
            new Document({
                pageContent:
                  'El motor HTTP por defecto de NestJS es Express, pero puede ser cambiado a Fastify para un mejor rendimiento.',
                metadata: { source: 'doc2' },
              }),
            new Document({
                pageContent:
                  'LangChain es una librería que ayuda a orquestar interacciones con LLMs, como en los sistemas RAG.',
                metadata: { source: 'doc3' },
            }),
        ]

        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const splitDocs = await textSplitter.splitDocuments(docs);

        try {
            const collection = await this.vectorStore.ensureCollection();
            await collection.delete({ where: {} });
            this.logger.log('Colección eliminada');

        } catch (error) {
            this.logger.warn(`Error al eliminar la colección: ${error.message}`);

        }
        
        await this.vectorStore.addDocuments(splitDocs);
    }
    
    private async loadAndProcessDocuments() {
        this.logger.log('Loading documents from the knowledge base...');
        const knowledgeBasePath = path.join(process.cwd(), 'knowledge_base');
        const allFiles = await this.recursivelyFindFiles(knowledgeBasePath);
        const markdownFiles = allFiles.filter((file) => file.endsWith('.md'));

        const docs = await Promise.all(
            markdownFiles.map(async (filePath) => {
              const content = await fs.readFile(filePath, 'utf-8');
              const tag = path.basename(filePath, '.md');
              return new Document({ pageContent: content, metadata: { tag } });
            }),
          );
      
          const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
          const splitDocs = await textSplitter.splitDocuments(docs);

        try {
            const collection = await this.vectorStore.ensureCollection();
            const allDocsInCollection = await collection.get();

            if (allDocsInCollection.ids.length > 0) {
                await collection.delete({ ids: allDocsInCollection.ids });
                this.logger.log(`Existing collection cleaned (${allDocsInCollection.ids.length} documents removed).`);
            }

        } catch (error) {
            this.logger.warn(`Error deleting collection: ${error.message}`);

        }
        
        await this.vectorStore.addDocuments(splitDocs);
    }

    private async recursivelyFindFiles(dir: string): Promise<string[]> {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(
            dirents.map((dirent) => {
                const res = path.resolve(dir, dirent.name);
                return dirent.isDirectory() ? this.recursivelyFindFiles(res) : res;
            }),
        );
        return Array.prototype.concat(...files);
    }

    async generateDoctorComment(dto: GenerateCommentDto & { language?: string }): Promise<string> {
        const { patient, results, prevData, language } = dto;
if (!patient) {
            throw new BadRequestException('Patient field is required.');
        }
        if (!results || !Array.isArray(results)) {
            throw new BadRequestException('Results field is required and must be an array.');
        }
        this.logger.log(`Generating doctor comment for patient with goal: ${JSON.stringify(patient.goal)}`);

        // --- 1. Compare current vs previous biomarkers ---
        let biomarkerChanges: string[] = [];
        let improvedMarkers: any[] = [];
        let worsenedMarkers: any[] = [];
        let significantMarkers: any[] = [];
        let prevResultsMap: Record<string, any> = {};
        if (prevData?.results && prevData.results.length > 0) {
            prevData.results.forEach(r => {
                prevResultsMap[r.name] = r;
            });
            results.forEach(current => {
                const prev = prevResultsMap[current.name];
                if (prev) {
                    // Detect improvement
                    if ((prev.status !== 'Healthy' && current.status === 'Healthy')) {
                        improvedMarkers.push(current);
                        biomarkerChanges.push(`Your ${current.name} has improved from '${prev.status}' in your previous test to 'Healthy' now. This is a good sign and may reflect positive changes in your lifestyle, diet, or treatment.`);
                    }
                    // Detect worsening
                    else if ((prev.status === 'Healthy' && current.status !== 'Healthy')) {
                        worsenedMarkers.push(current);
                        biomarkerChanges.push(`Your ${current.name} was 'Healthy' in your previous test and is now '${current.status}'. This change may be influenced by recent lifestyle factors, such as starting a new exercise regime or dietary changes.`);
                        if (current.status === 'High' || current.status === 'Low') {
                            significantMarkers.push(current);
                        }
                    }
                    // Detect other changes
                    else if (prev.status !== current.status) {
                        biomarkerChanges.push(`The marker ${current.name} has changed from '${prev.status}' to '${current.status}'.`);
                        if (current.status === 'High' || current.status === 'Low') {
                            significantMarkers.push(current);
                        }
                    }
                } else {
                    // If no previous result, check if current is significant
                    if (current.status === 'High' || current.status === 'Low') {
                        significantMarkers.push(current);
                    }
                }
            });
        } else {
            // If no previous results, check current for significant markers
            results.forEach(current => {
                if (current.status === 'High' || current.status === 'Low') {
                    significantMarkers.push(current);
                }
            });
        }

        // --- 1b. Add specific explanations for unexpected results ---
        // results.forEach(current => {
        //     if (current.name === 'progesterone' && patient.gender === 'Male' && current.status === 'High') {
        //         biomarkerChanges.push(`Your progesterone level is high for a male. This can sometimes be seen with certain medications, supplements, or rarely, underlying health conditions. If you are not taking any medication or supplements that could explain this, it is worth discussing with your GP.`);
        //     }
        // });

        // --- 2. Compare current vs previous profile ---
        let profileChanges: string[] = [];
        if (prevData?.profile) {
            const prev = prevData.profile;
            // Weight
            if (prev.weightKg !== undefined && patient.weightKg !== undefined && prev.weightKg !== patient.weightKg) {
                if (patient.weightKg < prev.weightKg) {
                    profileChanges.push(`You have lost weight (${prev.weightKg}kg → ${patient.weightKg}kg). Well done if this was your goal!`);
                } else {
                    profileChanges.push(`Your weight has increased (${prev.weightKg}kg → ${patient.weightKg}kg). If this was not your intention, consider reviewing your diet and physical activity.`);
                }
            }
            // Exercise
            if (prev.exercise !== undefined && patient.exercise !== undefined && prev.exercise !== patient.exercise) {
                if (patient.exercise.toLowerCase() === 'sedentary') {
                    profileChanges.push(`I see your exercise frequency has decreased. We all have times when it is more difficult to stay active, but I encourage you to return to your previous activity level. Even walking for 30 minutes a day can improve your cardiovascular health and support weight management.`);
                } else {
                    profileChanges.push(`You have improved your exercise level! Staying active is key to your overall health.`);
                }
            }
            // Diet
            if (prev.dietType !== undefined && patient.dietType !== undefined && prev.dietType !== patient.dietType) {
                profileChanges.push(`You have changed your diet type from "${prev.dietType}" to "${patient.dietType}". Remember, a balanced diet is fundamental for your wellbeing.`);
            }
            // Supplements
            if (JSON.stringify(prev.supplements) !== JSON.stringify(patient.supplements)) {
                profileChanges.push(`I see changes in your supplementation. If you have any doubts about which supplements to take, please consult a healthcare professional.`);
            }
            // Conditions
            if (JSON.stringify(prev.conditions) !== JSON.stringify(patient.conditions)) {
                profileChanges.push(`Your health conditions have changed. If you have any new condition, it is important to monitor it and follow medical recommendations.`);
            }
            // Alcohol
            if (prev.alcoholConsumption !== undefined && patient.alcoholConsumption !== undefined && prev.alcoholConsumption !== patient.alcoholConsumption) {
                profileChanges.push(`Your alcohol consumption has changed from "${prev.alcoholConsumption}" to "${patient.alcoholConsumption}". Reducing alcohol intake has multiple health benefits.`);
            }
            // Smoker
            if (prev.isSmoker !== undefined && patient.isSmoker !== undefined && prev.isSmoker !== patient.isSmoker) {
                if (patient.isSmoker) {
                    profileChanges.push(`You have started smoking. I recommend considering quitting, as this has a significant positive impact on your health.`);
                } else {
                    profileChanges.push(`You have stopped smoking! Congratulations, this is one of the best decisions for your health.`);
                }
            }
            // Sport/Exercise
            if (prev.sportOrExercise !== undefined && patient.sportOrExercise !== undefined && prev.sportOrExercise !== patient.sportOrExercise) {
                profileChanges.push(`Your sporting activity has changed from "${prev.sportOrExercise}" to "${patient.sportOrExercise}".`);
            }
            if (prev.sportFrequency !== undefined && patient.sportFrequency !== undefined && prev.sportFrequency !== patient.sportFrequency) {
                profileChanges.push(`The frequency of your sporting activity has changed from "${prev.sportFrequency}" to "${patient.sportFrequency}".`);
            }
            if (prev.trainingInformation !== undefined && patient.trainingInformation !== undefined && prev.trainingInformation !== patient.trainingInformation) {
                profileChanges.push(`Your training information has changed. If you have modified your routine, make sure it aligns with your goals and abilities.`);
            }
            if (prev.additionalInformation !== undefined && patient.additionalInformation !== undefined && prev.additionalInformation !== patient.additionalInformation) {
                profileChanges.push(`You have added new relevant health information: "${patient.additionalInformation}".`);
            }
        }

        // --- 3. Generate strings for the prompt ---
        let biomarkerChangeSummary = '';
        if (improvedMarkers.length > 0) {
            biomarkerChangeSummary += improvedMarkers.map(m => `The marker ${m.name} has improved and is now in the healthy range. This may be due to positive changes in your lifestyle, diet, or treatment. Keep it up!`).join('\n');
        }
        if (worsenedMarkers.length > 0) {
            biomarkerChangeSummary += worsenedMarkers.map(m => `The marker ${m.name} has worsened and is now outside the healthy range. This may be due to recent changes in your profile or habits. I recommend reviewing your diet, physical activity, and following the advice to return to the healthy range.`).join('\n');
        }
        if (biomarkerChanges.length > 0) {
            biomarkerChangeSummary += biomarkerChanges.join('\n');
        }
        let profileChangeSummary = '';
        if (profileChanges.length > 0) {
            profileChangeSummary = profileChanges.join('\n');
        }

        // --- 4. Pass flag for significant markers ---
        const hasSignificantMarkers = significantMarkers.length > 0;

        const outOfRangeMarkers = results.filter((r) => r.status !== 'Healthy');
        const inRangeMarkers = results.filter((r) => r.status === 'Healthy');
    
        if (outOfRangeMarkers.length === 0) {
          return this.generateHealthyComment(inRangeMarkers);
        }
    
        const retrievalQueries = outOfRangeMarkers.flatMap(marker => {
            const queries = [marker.name];
            if (patient.goal) queries.push(`goal: ${patient.goal} and ${marker.name}`);
            if (patient.sportOrExercise) queries.push(`${patient.sportOrExercise} and ${marker.name}`);
            if (patient.isSmoker) queries.push(`smoking and ${marker.name}`);
            if (patient.alcoholConsumption.toLowerCase() !== 'none') queries.push(`alcohol consumption and ${marker.name}`);
            if (patient.exercise.toLowerCase() === 'sedentary') queries.push(`sedentary lifestyle and ${marker.name}`);
            if (patient.dietType) queries.push(`${patient.dietType} diet and ${marker.name}`);
            if (patient.isTransitioning) queries.push(`gender transition and ${marker.name}`);
            if (patient.conditions && patient.conditions.length > 0) {
                patient.conditions.forEach(condition => queries.push(`${condition} and ${marker.name}`));
            }
            return queries;
        });
        this.logger.log(`Retrieval queries: ${retrievalQueries.join(', ')}`);

        let allRevelantDocs: Document[] = [];
        const collection = await this.vectorStore.ensureCollection();
        for (const query of retrievalQueries) {
            const queryEmbeddings = await this.embeddings.embedQuery(query);
            const queryResults = await collection.query({
                queryEmbeddings: [queryEmbeddings]
            });

            if (queryResults.documents && queryResults.documents.length > 0) {
                for (let i = 0; i < queryResults.documents[0].length; i++) {
                    const pageContent = queryResults.documents[0][i];
                    // Ensure pageContent is not null
                    if (pageContent) {
                        allRevelantDocs.push(new Document({
                            pageContent: pageContent,
                            metadata: queryResults.metadatas[0][i] || {},
                        }));
                    }
                }
            }
        }
    
        const uniqueDocuments = Array.from(new Map(allRevelantDocs.map(doc => [doc.pageContent, doc])).values());
        const context = formatDocumentsAsString(uniqueDocuments);
    
        const systemTemplate = `You are "Dr. Forth", a digital health advisor. Your task is to write a commentary that is clear, evidence-based, reassuring, and actionable, mirroring the style of a thoughtful GP's letter. The commentary should flow as natural, continuous text, not as a report with headings.

            **CRITICAL RULES:**
            1.  **TONE & STYLE:** Maintain a professional, encouraging, and slightly formal tone. Write in full paragraphs. Do not use markdown headings or numbered lists.
            2.  **FRAME AROUND THE GOAL:** The entire commentary, especially the advice, MUST be framed in the context of the patient's stated goal. For example, "To help you achieve your goal of losing weight, let's look at...". Also, if the patient's goal is to lose weight or improve their health and their weight is improving, mention this positively in the commentary.
            3.  **PERSONALISE:** Your recommendations MUST be consistent and safe for the patient's profile. If a patient is sedentary, suggest starting with gentle exercise. If vegan, recommend plant-based nutrient sources.
            4.  **EVIDENCE-BASED:** Base your explanations STRICTLY on the provided CONTEXT. Do not add external information.
            5.  **NUANCE:** For 'Moderately High' or 'Moderately Low' results, use softer language (e.g., "is slightly elevated and worth monitoring").
            6.  **SAFETY FIRST:** For significant results (e.g., very high cholesterol, poor kidney function), mention the need to discuss with the GP only in the concluding summary, not in every paragraph. Only include this advice if the variable 'hasSignificantMarkers' is true.
            7.  **LANGUAGE:** The commentary MUST be written in British English.
            8.  **CHANGES:** You MUST mention and explain any changes in biomarker results by comparing the current results with the previous results (prevData). For example, if a marker has improved or worsened, mention the previous and current status and provide a possible explanation based on the patient's profile and lifestyle changes. If there are changes in the patient's profile (e.g. weight, exercise, diet, supplements), mention and explain these changes in the commentary.
            9.  **RELEVANCE:** Do NOT mention a biomarker in the commentary if you cannot provide a plausible, evidence-based explanation for its change or status. For example, if progesterone is high in a male and there is no evidence-based explanation, do NOT include it in the commentary.

            **COMMENTARY FLOW:**

            **1. Opening:** Start with a single, positive, and reassuring sentence. For example: "I'm pleased to report that the majority of your blood results are entirely normal with no cause for concern. There are just a few points that are worth highlighting to you."

            **2. Detailed Review of Out-of-Range Markers:** Transition smoothly to discuss the results that require attention. Address EACH out-of-range marker one by one in its own detailed paragraph. For each marker, weave together the following points naturally:
                - **The Implication:** Explain what the result means for the patient's health.
                - **Actionable Advice:** Provide specific, practical lifestyle, diet, or exercise recommendations from the CONTEXT.
                - **Next Steps & Referrals:** If applicable, recommend actions like using the QRisk3 website or consulting their NHS GP. Suggest a re-test in 3-6 months to monitor changes.

            **3. Acknowledging Patient Effort & Genetics:** After discussing the specific markers, include a brief, encouraging paragraph acknowledging that the patient may already have a healthy lifestyle and that genetics can play a role.

            **4. Healthy Markers Summary:** Briefly and positively mention the markers that are in the healthy range, grouping them logically if possible. For example: "On a positive note, I am pleased to see your hormone profile is normal with healthy levels of FSH, LH, and oestradiol.". Also, mention those markers that have improved compared to the previous results, such as "Your vitamin D level has improved from 'Low' to 'Healthy'. This is a positive change and may reflect improvements in your diet or sun exposure.".

            **5. Concluding Summary:** Provide a brief, final summary paragraph to wrap up the key takeaways.

            **6. Closing:** End simply with "Best wishes,".

            **CONTEXT (Your knowledge base):**
            {context}
        `;

        const prompt = ChatPromptTemplate.fromMessages([
        ['system', systemTemplate],
        ['human', `Please generate the commentary for the following patient and their results.

            **PATIENT'S DETAILED PROFILE:**
            {patientProfile}

            **BLOOD TEST RESULTS:**
            {results}

            **CHANGES IN BLOOD TEST RESULTS COMPARED TO PREVIOUS TEST:**
            {biomarkerChangeSummary}

            **CHANGES IN PATIENT PROFILE COMPARED TO PREVIOUS PROFILE:**
            {profileChangeSummary}
        `],
        ]);
    
        const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    
        const patientProfileString = `
            - Goal: ${patient.goal || 'Not specified'}
            - Age: ${patient.age}, Gender: ${patient.gender}, Sex at Birth: ${patient.sexAtBirth}
            - Weight: ${patient.weightKg || 'N/A'} kg, Height: ${patient.heightCm || 'N/A'} cm
            - Lifestyle: Smoker? ${patient.isSmoker ? 'Yes' : 'No'}, Alcohol: ${patient.alcoholConsumption}, Exercise: ${patient.exercise}
            - Sport: ${patient.sportOrExercise || 'None'}, Frequency: ${patient.sportFrequency || 'N/A'}
            - Diet: ${patient.dietType}
            - Supplements: ${patient.supplements?.join(', ') || 'None'}
            - Conditions: ${patient.conditions?.join(', ') || 'None'}
            - Training Info: ${patient.trainingInformation || 'None'}
            - Additional Info: ${patient.additionalInformation || 'None'}
        `;
    
        // Save the last prompt string
        const formattedPrompt = await prompt.format({
            context,
            patientProfile: patientProfileString,
            results: JSON.stringify(results, null, 2),
            inRangeMarkerNames: inRangeMarkers.map(m => m.name).join(', '),
            goal: patient.goal || 'Not specified',
            biomarkerChangeSummary,
            profileChangeSummary,
            hasSignificantMarkers,
        });
        this.lastPrompt = formattedPrompt;

        const result = await chain.invoke({
            context,
            patientProfile: patientProfileString,
            results: JSON.stringify(results, null, 2),
            inRangeMarkerNames: inRangeMarkers.map(m => m.name).join(', '),
            goal: patient.goal || 'Not specified',
            biomarkerChangeSummary,
            profileChangeSummary,
            hasSignificantMarkers,
        });

        return result;
    }

    private async generateHealthyComment(inRangeMarkers: any[]): Promise<string> {
        const markerNames = inRangeMarkers.map(m => m.name).join(', ');
        return `Excellent news! All of your results are within the healthy range, including ${markerNames}. This indicates a good general state of health in the areas tested. Keep up your good lifestyle habits. To ensure everything remains in order, we recommend repeating the test in about 6 months.`;
    }
    
    async askQuestion(question: string): Promise<string> {
        this.logger.log(`Question received: ${question}`);

        try {
            // Step 1: Get the ChromaDB collection directly.
            const collection = await this.vectorStore.ensureCollection();
      
            // Step 2: Create the embedding for the user's question.
            const questionEmbedding = await this.embeddings.embedQuery(question);
      
            // Step 3: Use the native query method of the Chroma collection.
            // We pass the embedding as an array inside another array, as expected by the API.
            const results = await collection.query({
              queryEmbeddings: [questionEmbedding],
              nResults: 4,
            });
      
            // Step 4: Manually construct LangChain documents from the results.
            const relevantDocs: Document[] = [];
            if (results.documents && results.documents.length > 0) {
              for (let i = 0; i < results.documents[0].length; i++) {
                const pageContent = results.documents[0][i];

                // Ensure pageContent is not null
        if (pageContent) {
                    relevantDocs.push(new Document({
                        pageContent: pageContent,
                        metadata: results.metadatas[0][i] || {},
                    }));
                }
              }
            }
            const context = formatDocumentsAsString(relevantDocs);
            this.logger.log(`Context recovered: ${context.substring(0, 200)}...`);
      

            // Step 5: Define the prompt and generation chain.
            const systemTemplate = `Use the following context fragments to answer the question at the end.
            If you don't know the answer, simply say you don't know; don't try to make up an answer.
            ----------------
            {context}`;
            
            const prompt = ChatPromptTemplate.fromMessages([
              ['system', systemTemplate],
              ['human', '{question}'],
            ]);
      
            const chain = RunnableSequence.from([
              prompt,
              this.llm,
              new StringOutputParser(),
            ]);
      
            // Step 6: Invoke the chain with the context and question.
            const answer = await chain.invoke({
                context: context,
                question: question,
            });
            
            return answer;
      
        } catch (error) {
            this.logger.error(`Error en askQuestion: ${error.message}`, error.stack);
            throw error; // Throw the error to NestJS to handle it
        }
    }

    getLastPrompt(): string | null {
        return this.lastPrompt;
    }
}
