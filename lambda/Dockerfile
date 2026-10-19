FROM ghcr.io/tidywf/nemo-image:0.0.0.9004

# use pip from the nemo conda env
RUN pip install awslambdaric awscli python-ulid

WORKDIR /var/task
COPY handler.py ./

ENTRYPOINT ["python3", "-m", "awslambdaric"]
CMD ["handler.handler"]
