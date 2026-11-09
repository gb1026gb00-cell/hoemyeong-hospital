# V134 CH.04 기록보관실 서버 퍼즐 연결

- CH.03 완료 후 서버의 ch04_enter 호출 (기존 V133 버튼 유지)
- 기록 4곳(ch04_inspect), 수술 기록(ch04_surgery_record), 역할별 증언(ch04_witness) 조작 UI 연결
- 사건 재구성(ch04_vote)은 원본 서버가 정답·2인 동의·단서 획득 조건을 판정
- CH.04 완료 시 CH.05 진입 버튼 노출. 제0유물 파편 조건은 서버에서 유지
- 기존 index.html의 실사형 CH.01 UI와 Canvas 영상 코드를 변경하지 않음
- 원본 server.js, engine.html, 모든 G영상 및 에셋을 그대로 보존

**미완료:** CH.04 실사형 배경/터치 오브젝트, G09의 Canvas 재생 연결, 실제 2인 서버 테스트, CH.05~06 UI. 배포 금지.
