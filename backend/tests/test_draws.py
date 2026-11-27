from __future__ import annotations


def test_latest_draw(client, make_draw):
    make_draw("26012")
    make_draw("26014")
    make_draw("26013")
    response = client.get("/api/draws/latest")
    assert response.status_code == 200
    body = response.json()
    assert body["draw_no"] == "26014"
    assert body["front_numbers"] == [1, 2, 3, 4, 5]
    assert body["prizes"][0]["prize_level"] == "一等奖"


def test_latest_when_empty(client):
    assert client.get("/api/draws/latest").status_code == 404


def test_list_pagination(client, make_draw):
    for number in range(26010, 26015):
        make_draw(str(number))
    response = client.get("/api/draws?page=1&pageSize=2")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 5
    assert [item["draw_no"] for item in body["items"]] == ["26014", "26013"]

    second = client.get("/api/draws?page=3&pageSize=2").json()
    assert [item["draw_no"] for item in second["items"]] == ["26010"]


def test_detail(client, make_draw):
    make_draw("26014")
    response = client.get("/api/draws/26014")
    assert response.status_code == 200
    assert response.json()["draw_no"] == "26014"


def test_next_draw(client, make_draw):
    make_draw("26014")
    response = client.get("/api/draws/next")
    assert response.status_code == 200
    assert response.json()["draw_no"] == "26015"


def test_next_draw_year_rollover(client, make_draw):
    make_draw("26156")
    assert client.get("/api/draws/next").json()["draw_no"] == "27001"


def test_next_draw_without_history(client):
    assert client.get("/api/draws/next").status_code == 404


def test_detail_not_found(client):
    response = client.get("/api/draws/99999")
    assert response.status_code == 404
    assert response.json()["detail"] == "期号不存在"
