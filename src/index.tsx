import * as TES from 'tesseract.js';
import * as allCards from './cards.txt';

const cards = allCards.split('\n').filter(s => s.trim() != "");

const video = document.createElement('video');
video.setAttribute('playsinline', '');
video.setAttribute('autoplay', '');
video.setAttribute('muted', '');
video.style.width = '800px';
video.style.height = '800px';

const textOutput = document.createElement('p');
document.body.appendChild(textOutput);
const matchedCardOutput = document.createElement('p');
document.body.appendChild(matchedCardOutput);

(async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "environment"  // could be "user" or "environment"
    }
  });
  video.srcObject = stream;

  const imageDiv = document.createElement('div');
  document.body.appendChild(imageDiv);
  imageDiv.style.display = 'inline-block';
  imageDiv.appendChild(video);
  const resultCanvas = document.createElement('img');
  imageDiv.appendChild(resultCanvas);

  let started = false;
  video.onresize = async () => {
    if (started) return;
    started = true;

    video.style.width = `${video.videoWidth}px`;
    video.style.height = `${video.videoHeight}px`;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    resultCanvas.width = video.videoWidth;
    resultCanvas.height = video.videoHeight;
    resultCanvas.style.marginLeft = '20px';

    const worker = TES.createWorker({
      logger: m => console.log(m)
    });
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    let counter = 0;
    const detect = async () => {
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = canvas.toDataURL("image/png");

      const result = await worker.recognize(img);

      const matchedCard = tryMatch(result.data.text);
      const tokens = tokenize(result.data.text);

      //textOutput.innerHTML = `${ counter++ }: ${ result.data.text } `
      //textOutput.innerHTML += `< br /> ${ tokens.join(" ") } <br />${ tokens.filter(t => allCardTokens.has(t)).join(" ") } `;
      if (matchedCard != null) {
        matchedCardOutput.innerHTML = matchedCard;
        resultCanvas.src = img;
      }

      setTimeout(detect, 100);
    };

    detect();

  };
})();

function tokenize(s: string): string[] {
  return s.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t != "");
}
const cardsData = cards.map(c => ({
  card: c,
  tokens: tokenize(c),
}));

function editDistance(tokens1: string[], tokens2: string[]) {
  // Wagner-Fischer algorithm

  const distance: number[][] = [];
  for (let i = 0; i <= tokens1.length; i++) {
    const row = [];
    for (let j = 0; j <= tokens2.length; j++) row.push(0);
    distance.push(row);
  }

  for (let i = 1; i <= tokens1.length; i++) distance[i][0] = i;
  for (let j = 1; j <= tokens2.length; j++) distance[0][j] = j;

  for (let j = 1; j <= tokens2.length; j++) for (let i = 1; i <= tokens1.length; i++) {
    const substitutionCost = tokens1[i] == tokens2[j] ? 0 : 1;
    distance[i][j] = Math.min(
      distance[i - 1][j] + 1, // delete
      distance[i][j - 1] + 1, // insert
      distance[i - 1][j - 1] + substitutionCost, // substitute
    );
  }

  return distance[tokens1.length][tokens2.length];
}

const allCardTokens = new Set(cardsData.flatMap(c => c.tokens));

const allTokens = document.createElement('p');
//allCardTokens.forEach(t => allTokens.innerHTML += ` ${ t } `);
document.body.appendChild(allTokens)

const matchOutput = document.createElement('p');
document.body.appendChild(matchOutput);

function tryMatch(text: string): string | null {
  const textTokens = tokenize(text).filter(t => allCardTokens.has(t));
  const comparisons =
    cardsData
      .map(card => ({ ...card, distance: editDistance(textTokens, card.tokens) / card.tokens.length }))
      .sort((c1, c2) => c1.distance - c2.distance);
  if (comparisons.length == 0) return null;

  const best = comparisons[0];
  const nextBest = comparisons[1];
  //matchOutput.innerHTML = `${ best.distance }: ${ best.tokens.join(" ") } `;
  //matchOutput.innerHTML += `</br > ${ nextBest.distance }: ${ nextBest.tokens.join(" ") } `;

  if (best.distance < 0.5 + (0.015 * textTokens.length) && (best.distance <= 0.1 || (nextBest.distance - best.distance) >= 0.2)) {
    return best.card;
  }
  return null;
}