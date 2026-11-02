# 회명병원 v5.23 — 인터넷 협동 연결 실험

## 서버 배포 (Render 예시)
1. 이 폴더의 `server.js`와 `package.json`을 GitHub 저장소에 올립니다.
2. Render에서 **New → Web Service**를 만들고 해당 저장소를 연결합니다.
3. Build command: `npm install` / Start command: `npm start`
4. 배포된 서버 URL이 `https://example.onrender.com`이면 게임의 서버 주소에 `wss://example.onrender.com`을 입력합니다.
5. `index.html`은 별도로 GitHub Pages 등에 올리고 서로 다른 기기에서 동일한 방 코드, 서로 다른 조사원으로 입장합니다.

## 로컬 실행
`npm install` → `npm start` 후 게임의 서버 주소를 `ws://localhost:3000`으로 설정합니다. 로컬 서버는 다른 기기에서 접속할 수 없습니다.

## 구현 범위와 한계
- 방 생성/입장, 최대 8인, 조사원 중복 방지, 접속자 목록, 인형 부품 수집 상태, 단서 메시지 공유.
- 방이 비면 메모리에서 삭제됩니다. DB 저장, 인증, 채팅, 기존 퍼즐/문/서랍 상태 동기화는 아직 없습니다.
- 무료 호스팅은 슬립/연결 제한이 있을 수 있으므로 정식 운영 전 요금·제한 확인이 필요합니다.
- 이 파일은 개발용 프로토타입이며 서버는 아직 실제로 배포되지 않았습니다.
