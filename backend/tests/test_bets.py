from __future__ import annotations


def _bet(
    client,
    draw_no="26014",
    front=(1, 2, 3, 4, 5),
    back=(1, 2),
    additional=False,
    multiplier=2,
    ticket_amount=None,
):
    payload = {
        "draw_no": draw_no,
        "front_numbers": list(front),
        "back_numbers": list(back),
        "is_additional": additional,
        "multiplier": multiplier,
    }
    if ticket_amount is not None:
        payload["ticket_amount"] = ticket_amount
    return client.post("/api/bets", json=payload)


def test_create_winning_bet(client, register, make_draw):
    register()
    make_draw()
    response = _bet(client)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "won"
    assert body["prize_level"] == "一等奖"
    assert body["prize_amount"] == 2_000_000
    assert body["cost"] == 4


def test_multiplier_one(client, register, make_draw):
    register()
    make_draw()
    body = _bet(client, multiplier=1).json()
    assert body["cost"] == 2
    assert body["prize_amount"] == 1_000_000


def test_additional_prize(client, register, make_draw):
    register()
    make_draw()
    body = _bet(client, additional=True).json()
    assert body["cost"] == 6
    assert body["prize_amount"] == 3_600_000


def test_fixed_prize_third(client, register, make_draw):
    register()
    make_draw()
    body = _bet(client, front=(1, 2, 3, 4, 30), back=(1, 2), multiplier=3).json()
    assert body["prize_level"] == "三等奖"
    assert body["prize_amount"] == 15_000


def test_seventh_prize(client, register, make_draw):
    register()
    make_draw()
    body = _bet(client, front=(1, 2, 3, 30, 31), back=(9, 10)).json()
    assert body["prize_level"] == "七等奖"
    assert body["prize_amount"] == 10


def test_bonus_prize_when_ticket_qualifies(client, register, make_draw):
    register()
    make_draw(
        "26066",
        prizes=[("三等奖", 6666), ("三等奖派奖", 3333)],
    )
    body = _bet(
        client,
        draw_no="26066",
        front=(1, 2, 3, 4, 30),
        back=(1, 2),
        multiplier=9,
        ticket_amount=18,
    ).json()
    assert body["prize_level"] == "三等奖"
    assert body["prize_amount"] == 89_991


def test_bonus_prize_requires_18_yuan_ticket(client, register, make_draw):
    register()
    make_draw(
        "26066",
        prizes=[("三等奖", 6666), ("三等奖派奖", 3333)],
    )
    body = _bet(
        client,
        draw_no="26066",
        front=(1, 2, 3, 4, 30),
        back=(1, 2),
        multiplier=9,
        ticket_amount=10,
    ).json()
    assert body["prize_amount"] == 59_994


def test_multiplier_change_recomputes_bonus_threshold(client, register, make_draw):
    register()
    make_draw("26066", prizes=[("三等奖", 6666), ("三等奖派奖", 3333)])
    created = _bet(
        client, draw_no="26066", front=(1, 2, 3, 4, 30), back=(1, 2), multiplier=2
    ).json()
    assert created["ticket_amount"] is None
    assert created["prize_amount"] == 13_332

    updated = client.patch(f"/api/bets/{created['id']}", json={"multiplier": 9}).json()
    assert updated["cost"] == 18
    assert updated["prize_amount"] == 89_991


def test_ticket_amount_can_be_cleared(client, register, make_draw):
    register()
    make_draw("26066", prizes=[("三等奖", 6666), ("三等奖派奖", 3333)])
    created = _bet(
        client,
        draw_no="26066",
        front=(1, 2, 3, 4, 30),
        back=(1, 2),
        multiplier=2,
        ticket_amount=18,
    ).json()
    assert created["prize_amount"] == 19_998

    cleared = client.patch(
        f"/api/bets/{created['id']}", json={"ticket_amount": None}
    ).json()
    assert cleared["ticket_amount"] is None
    assert cleared["prize_amount"] == 13_332


def test_high_pool_fixed_prize(client, register, make_draw):
    register()
    make_draw("26070", prizes=[("四等奖", 380)])
    body = _bet(client, draw_no="26070", front=(1, 2, 3, 4, 30), back=(1, 9)).json()
    assert body["prize_level"] == "四等奖"
    assert body["prize_amount"] == 760


def test_losing_bet(client, register, make_draw):
    register()
    make_draw()
    body = _bet(client, front=(6, 7, 8, 9, 10), back=(3, 4)).json()
    assert body["status"] == "lost"
    assert body["prize_level"] is None
    assert body["prize_amount"] == 0


def test_reject_legacy_draw(client, register, make_draw):
    register()
    make_draw("26013", rule_version="legacy")
    response = _bet(client, draw_no="26013")
    assert response.status_code == 400
    assert "不支持自动核算" in response.json()["detail"]


def test_future_draw_pending(client, register):
    register()
    response = _bet(client, draw_no="26136")
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "pending"
    assert body["prize_amount"] == 0
    assert body["draw_date"] is None


def test_summary(client, register, make_draw):
    register()
    make_draw()
    _bet(client)  # cost 4, prize 2,000,000
    _bet(client, front=(6, 7, 8, 9, 10), back=(3, 4))  # cost 4, lost
    body = client.get("/api/bets/summary").json()
    assert body["total_cost"] == 8
    assert body["total_prize"] == 2_000_000
    assert body["net"] == 1_999_992
    assert body["bet_count"] == 2


def test_pending_not_in_net(client, register):
    register()
    body = _bet(client, draw_no="26136").json()
    assert body["status"] == "pending"
    summary = client.get("/api/bets/summary").json()
    assert summary["total_cost"] == 0
    assert summary["pending_cost"] == 4
    assert summary["pending_count"] == 1
    assert summary["net"] == 0
    assert summary["by_draw"][0]["settled"] is False


def test_missing_draw_no_defaults_to_next(client, register, make_draw):
    register()
    make_draw("26014")
    response = client.post(
        "/api/bets",
        json={
            "front_numbers": [1, 2, 3, 4, 5],
            "back_numbers": [1, 2],
            "is_additional": False,
            "multiplier": 2,
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["draw_no"] == "26015"
    assert body["status"] == "pending"


def test_bets_sorted_by_draw_desc(client, register, make_draw):
    register()
    make_draw("26014")
    make_draw("26015")
    _bet(client, draw_no="26014")
    _bet(client, draw_no="26015")
    body = client.get("/api/bets").json()
    assert [item["draw_no"] for item in body["items"]] == ["26015", "26014"]


def test_user_isolation(client, register, make_draw):
    register("alice")
    make_draw()
    bet_id = _bet(client).json()["id"]
    client.post("/api/auth/logout")
    register("bob")

    assert client.get("/api/bets").json()["total"] == 0
    assert client.patch(f"/api/bets/{bet_id}", json={"multiplier": 3}).status_code == 404
    assert client.delete(f"/api/bets/{bet_id}").status_code == 404


def test_update_and_delete(client, register, make_draw):
    register()
    make_draw()
    bet_id = _bet(client).json()["id"]
    updated = client.patch(f"/api/bets/{bet_id}", json={"multiplier": 5})
    assert updated.status_code == 200
    assert updated.json()["cost"] == 10
    assert updated.json()["prize_amount"] == 5_000_000
    assert client.delete(f"/api/bets/{bet_id}").status_code == 204
    assert client.get("/api/bets").json()["total"] == 0


def test_pending_then_recalc(client, register, make_draw, db):
    from datetime import date

    from app.services.sync import evaluate_bets_for_draw

    register()
    body = _bet(client, draw_no="26136").json()
    assert body["status"] == "pending"

    draw = make_draw("26136", draw_date=date(2026, 2, 4))
    evaluate_bets_for_draw(db, draw)
    db.commit()

    item = client.get("/api/bets").json()["items"][0]
    assert item["status"] == "won"
    assert item["prize_level"] == "一等奖"
