const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// Replace Energy Sim
const energySimStart = html.indexOf('<div id="pageEnergySim" class="main-tab-page hidden">');
const chatbotSimStart = html.indexOf('<div id="pageChatbotSim" class="main-tab-page hidden">');

let newEnergy = `
  <div id="pageEnergySim" class="main-tab-page hidden" style="padding:40px;">
    <div class="pres-page-header" style="margin-bottom: 24px;">
      <h1 class="pres-page-title">CEB Grid Optimization & Autonomous HVAC Intelligence</h1>
      <p class="pres-page-subtitle">Dual-engine energy reduction architecture (Pre-Cooling & Sensor Optimization).</p>
    </div>
    
    <div class="mermaid" style="text-align: center; background: #fff; padding: 24px; border-radius: 12px; border: 1px solid #CBD5E1; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
graph TD
    A[Maya's Phone App GPS] -->|Crosses 1km Geofence| B{Peak Tariff Checker}
    B -->|Peak Time| C[Delay HVAC]
    B -->|Off-Peak Time| D[Engage Pre-Cooling]
    D --> E((HVAC System))
    
    F[Living Room Motion Sensor] -->|No Motion 15m| G{Eco-Float Engine}
    G -->|Adjust Setpoint +1.5C| E
    
    style A fill:#F1F5F9,stroke:#94A3B8,stroke-width:2px
    style B fill:#FEF3C7,stroke:#F59E0B,stroke-width:2px
    style D fill:#ECFDF5,stroke:#10B981,stroke-width:2px
    style E fill:#DBEAFE,stroke:#3B82F6,stroke-width:2px
    style G fill:#ECFDF5,stroke:#10B981,stroke-width:2px
    </div>
  </div><!-- /pageEnergySim -->
`;

const energySimEnd = html.indexOf('</div><!-- /pageEnergySim -->') + '</div><!-- /pageEnergySim -->'.length;

// Replace Chatbot Sim
let newChatbot = `
  <div id="pageChatbotSim" class="main-tab-page hidden" style="padding:40px;">
    <div class="pres-page-header" style="margin-bottom: 24px;">
      <h1 class="pres-page-title">Enterprise AI Chatbot Guardrails & Skill Mesh Pipeline</h1>
      <p class="pres-page-subtitle">Demonstrating data privacy and semantic routing through a secure hardware air-gap.</p>
    </div>
    
    <div class="mermaid" style="text-align: center; background: #fff; padding: 24px; border-radius: 12px; border: 1px solid #CBD5E1; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
flowchart LR
    In(Raw User Prompt) --> L1[Layer 1: PDPA Masking]
    L1 --> L2[Layer 2: Semantic Router]
    L2 --> L3{Layer 3: Zero-Trust Air-Gap}
    L3 -- Valid Scope --> Out1(Execute Action)
    L3 -- Cross-Tenant Attempt --> Out2(Block & Flag)
    
    style In fill:#F1F5F9,stroke:#94A3B8
    style L1 fill:#DBEAFE,stroke:#3B82F6
    style L2 fill:#DBEAFE,stroke:#3B82F6
    style L3 fill:#FEF2F2,stroke:#EF4444
    style Out1 fill:#ECFDF5,stroke:#10B981
    style Out2 fill:#FEE2E2,stroke:#DC2626
    </div>
  </div><!-- /pageChatbotSim -->
`;

const chatbotSimEnd = html.indexOf('</div><!-- /pageChatbotSim -->') + '</div><!-- /pageChatbotSim -->'.length;

html = html.substring(0, energySimStart) + newEnergy + '\n\n' + newChatbot + html.substring(chatbotSimEnd);

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Replaced Energy and Chatbot with Mermaid Diagrams');
