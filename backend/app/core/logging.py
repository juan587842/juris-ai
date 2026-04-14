"""Logging configurado com structlog — mascara dados sensíveis (CPF, telefone, e-mail)."""
import logging
import re
import sys

import structlog


_SENSITIVE_PATTERNS = [
    (re.compile(r"\d{3}\.\d{3}\.\d{3}-\d{2}"), "***CPF***"),          # CPF
    (re.compile(r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}"), "***CNPJ***"),   # CNPJ
    (re.compile(r"\+?55?\s?\(?\d{2}\)?\s?\d{4,5}-?\d{4}"), "***TEL***"),  # telefone BR
    (re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"), "***EMAIL***"),
]


def _mask_sensitive(value: str) -> str:
    for pattern, replacement in _SENSITIVE_PATTERNS:
        value = pattern.sub(replacement, value)
    return value


def _sensitive_data_processor(
    logger: object, method: str, event_dict: dict
) -> dict:
    for key in ("message", "event", "content", "body", "text"):
        if key in event_dict and isinstance(event_dict[key], str):
            event_dict[key] = _mask_sensitive(event_dict[key])
    return event_dict


def configure_logging(log_level: str = "INFO") -> None:
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        _sensitive_data_processor,
        structlog.processors.StackInfoRenderer(),
    ]

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.dev.ConsoleRenderer() if True else structlog.processors.JSONRenderer(),
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
