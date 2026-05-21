#!/bin/bash

TENANCY="ocid1.tenancy.oc1..aaaaaaaadrdhymala26cqiimwt5srdjey7bmqdn6t76ljgv6oqt5c6lyfbsq"
SUBNET="ocid1.subnet.oc1.ap-chuncheon-1.aaaaaaaaydam2iglrharrtsnvtsnzqijxqc24h3ijwydvabahrezk4emrjiq"
IMAGE="ocid1.image.oc1.ap-chuncheon-1.aaaaaaaan3ml5enlvv4uonyln7ppzfhs7msfzjbwl54gomazoezivbl36twa"
SHAPE="VM.Standard.A1.Flex"
SSH_KEY=$(cat ~/.oci/oci_api_key.pem | grep -v "PRIVATE KEY" | tr -d '\n')

# SSH 공개키 경로 (생성)
SSH_PUB_KEY_FILE=~/.oci/hindsight_rsa.pub
SSH_KEY_FILE=~/.oci/hindsight_rsa

if [ ! -f "$SSH_KEY_FILE" ]; then
    ssh-keygen -t rsa -b 4096 -f "$SSH_KEY_FILE" -N "" -q
    echo "SSH 키 생성 완료: $SSH_KEY_FILE"
fi

echo "====================================="
echo " Oracle ARM 인스턴스 생성 재시도 스크립트"
echo " 종료: Ctrl+C"
echo "====================================="

ATTEMPT=0
while true; do
    ATTEMPT=$((ATTEMPT + 1))
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$TIMESTAMP] 시도 #$ATTEMPT..."

    RESULT=$(oci compute instance launch \
        --compartment-id "$TENANCY" \
        --availability-domain "eLCr:AP-CHUNCHEON-1-AD-1" \
        --shape "$SHAPE" \
        --shape-config '{"ocpus": 2, "memoryInGBs": 12}' \
        --image-id "$IMAGE" \
        --subnet-id "$SUBNET" \
        --assign-public-ip true \
        --display-name "hindsight-server" \
        --ssh-authorized-keys-file "$SSH_PUB_KEY_FILE" \
        2>&1)

    # FutureWarning 제거한 실제 응답
    CLEAN=$(echo "$RESULT" | grep -v FutureWarning | grep -v "warnings\." | grep -v strict)
    CODE=$(echo "$CLEAN" | python3 -c "import json,sys,re; s=sys.stdin.read(); m=re.search(r'\"code\":\s*\"([^\"]+)\"',s); print(m.group(1) if m else '')" 2>/dev/null)
    MSG=$(echo "$CLEAN" | python3 -c "import json,sys,re; s=sys.stdin.read(); m=re.search(r'\"message\":\s*\"([^\"]+)\"',s); print(m.group(1) if m else '')" 2>/dev/null)

    if echo "$CLEAN" | grep -q '"lifecycle-state"'; then
        echo ""
        echo "✅ 성공! 인스턴스 생성됨"
        PUBLIC_IP=$(echo "$CLEAN" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('public-ip','확인 필요'))" 2>/dev/null || echo "콘솔에서 확인")
        echo "Public IP: $PUBLIC_IP"
        echo "SSH 접속: ssh -i $SSH_KEY_FILE opc@$PUBLIC_IP"
        break
    elif [ "$CODE" = "InternalError" ] || echo "$MSG" | grep -qi "capacity\|host capacity"; then
        echo "  → ❌ 용량 부족 (code=$CODE) — 5분 후 재시도"
        sleep 300
    elif echo "$CLEAN" | grep -q "RequestException\|timed out\|Timeout"; then
        echo "  → ⚠️  타임아웃 — 1분 후 재시도"
        echo "  메시지: $MSG"
        sleep 60
    else
        echo "  → ⚠️  기타 오류 (code=$CODE) — 2분 후 재시도"
        echo "  메시지: $MSG"
        sleep 120
    fi
done
